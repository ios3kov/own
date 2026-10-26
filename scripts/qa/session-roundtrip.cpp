#include "llama.h"
#include "ggml-backend.h"
#include <algorithm>
#include <cstdio>
#include <fstream>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>
using Ctx = std::unique_ptr<llama_context, decltype(&llama_free)>;
static void require(bool value, const char *message) { if (!value) throw std::runtime_error(message); }
static Ctx make_ctx(llama_model *model) {
    auto p = llama_context_default_params();
    p.n_ctx=2048; p.n_batch=64; p.n_ubatch=64; p.n_threads=2; p.n_threads_batch=2;
    p.flash_attn_type=LLAMA_FLASH_ATTN_TYPE_DISABLED;
    p.offload_kqv=false; p.op_offload=false;
    auto *ctx=llama_init_from_model(model,p);
    require(ctx,"context creation");
    return Ctx(ctx,llama_free);
}
static void prefill(llama_context *ctx,std::vector<llama_token> &tokens) {
    for(size_t offset=0;offset<tokens.size();offset+=64) {
        auto count=static_cast<int32_t>(std::min<size_t>(64,tokens.size()-offset));
        require(llama_decode(ctx,llama_batch_get_one(tokens.data()+offset,count))==0,"chunked prompt decode");
    }
}
static llama_token greedy(llama_context *ctx, int vocabulary) {
    auto *logits=llama_get_logits_ith(ctx,-1);
    require(logits,"missing logits");
    return static_cast<llama_token>(std::max_element(logits,logits+vocabulary)-logits);
}
static std::vector<llama_token> continuation(llama_context *ctx,int vocabulary) {
    std::vector<llama_token> result;
    for (int i=0;i<8;++i) {
        auto token=greedy(ctx,vocabulary); result.push_back(token);
        require(llama_decode(ctx,llama_batch_get_one(&token,1))==0,"continuation decode");
    }
    return result;
}
int main(int argc,char **argv) {
    try {
        require(argc==3,"expected existing model and new owned output directory");
        llama_log_set([](lm_ggml_log_level level,const char *text,void*) {
            if(level==LM_GGML_LOG_LEVEL_ERROR) std::fputs(text,stderr);
        },nullptr);
        llama_backend_init();
        auto params=llama_model_default_params(); params.n_gpu_layers=0; params.use_extra_bufts=false;
        lm_ggml_backend_dev_t devices[]={lm_ggml_backend_dev_by_type(LM_GGML_BACKEND_DEVICE_TYPE_CPU),nullptr};
        require(devices[0]!=nullptr,"CPU backend missing");
        params.devices=devices;
        std::unique_ptr<llama_model,decltype(&llama_model_free)> model(
            llama_model_load_from_file(argv[1],params),llama_model_free);
        require(model!=nullptr,"model loading");
        const auto *vocab=llama_model_get_vocab(model.get());
        std::string prompt;
        for(int i=0;i<80;++i) prompt+="Once upon a time, a small puppy. ";
        std::vector<llama_token> tokens(2048);
        int n=llama_tokenize(vocab,prompt.c_str(),static_cast<int>(prompt.size()),tokens.data(),2048,true,true);
        require(n>512 && n<2000,"long prompt tokenization"); tokens.resize(n);
        auto reference=make_ctx(model.get());
        prefill(reference.get(),tokens);
        auto original_position=llama_memory_seq_pos_max(llama_get_memory(reference.get()),0);
        const std::string state=std::string(argv[2])+"/state.bin";
        require(!std::ifstream(state).good(),"refusing existing state output");
        require(llama_state_save_file(reference.get(),state.c_str(),tokens.data(),tokens.size()),"save state");
        auto expected=continuation(reference.get(),llama_vocab_n_tokens(vocab));
        auto restored=make_ctx(model.get());
        require(llama_memory_seq_pos_max(llama_get_memory(restored.get()),0)<0,"fresh context not empty");
        std::vector<llama_token> loaded(2048); size_t loaded_count=0;
        bool accepted=false,off_main=false; auto main_id=std::this_thread::get_id();
        std::thread worker([&] {
            off_main=std::this_thread::get_id()!=main_id;
            accepted=llama_state_load_file(restored.get(),state.c_str(),loaded.data(),loaded.size(),&loaded_count);
        });
        worker.join();
        require(accepted && off_main,"worker state load");
        loaded.resize(loaded_count);
        require(loaded==tokens,"restored token prefix mismatch");
        auto restored_position=llama_memory_seq_pos_max(llama_get_memory(restored.get()),0);
        require(restored_position==original_position && restored_position>=0,"actual KV position not restored");
        // The pinned engine stores KV memory, not output logits. Its completion code
        // also reevaluates the last matching prompt token before sampling.
        require(llama_memory_seq_rm(llama_get_memory(restored.get()),0,n-1,-1),"last-token KV trim");
        auto last=tokens.back();
        require(llama_decode(restored.get(),llama_batch_get_one(&last,1))==0,"restore last-token evaluation");
        auto actual=continuation(restored.get(),llama_vocab_n_tokens(vocab));
        require(actual==expected,"restored deterministic continuation mismatch");
        auto cold=make_ctx(model.get());
        prefill(cold.get(),tokens);
        require(continuation(cold.get(),llama_vocab_n_tokens(vocab))==expected,"cold control mismatch");
        const std::string corrupt=std::string(argv[2])+"/corrupt.bin";
        require(!std::ifstream(corrupt).good(),"refusing existing corrupt output");
        { std::ofstream file(corrupt,std::ios::binary); file<<"BAD"; }
        auto rejected=make_ctx(model.get());
        size_t invalid_count=0;
        bool corrupt_rejected=false;
        try { corrupt_rejected=!llama_state_load_file(rejected.get(),corrupt.c_str(),loaded.data(),loaded.size(),&invalid_count); }
        catch(const std::exception&) { corrupt_rejected=true; }
        require(corrupt_rejected,"corrupt file accepted");
        std::printf("{\"pass\":true,\"backend\":\"cpu\",\"prompt_tokens\":%d,\"restored_tokens\":%zu,\"kv_position\":%d,\"continuation_tokens\":%zu,\"reevaluated_tokens\":1,\"cold_control_equal\":true,\"worker_thread\":true,\"corrupt_rejected\":true}\n",
            n,loaded_count,restored_position,actual.size());
        return 0;
    } catch (const std::exception &error) {
        std::fprintf(stderr,"FAIL: %s\n",error.what()); return 1;
    }
}
