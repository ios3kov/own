import { create } from 'zustand';
interface ModelLoadState {
  phaseStartedAt:number; startedAt:number; totalDurationMs:number|null; phases:{phase:string;durationMs:number}[];
  ticket: number; active: boolean; type: 'text' | 'image' | null; phase: string; percent: number | null;
}
export const useModelLoadStore = create<ModelLoadState>(() => ({phaseStartedAt:0,startedAt:0,totalDurationMs:null,phases:[],ticket:0,active:false,type:null,phase:'Preparing model',percent:null}));
export function beginModelLoad(type: 'text' | 'image', phase = 'Checking model files'): number {
  const ticket=useModelLoadStore.getState().ticket+1;
  const now=Date.now();
  useModelLoadStore.setState({ticket,active:true,type,phase,percent:null,startedAt:now,phaseStartedAt:now,totalDurationMs:null,phases:[]});return ticket;
}
export function reportModelLoad(ticket: number, phase: string, percent: number | null = null): void {
  if (!useModelLoadStore.getState().active || useModelLoadStore.getState().ticket!==ticket) return;
  const previous=useModelLoadStore.getState();
  const now=Date.now();
  const timing=previous.phase===phase ? {} : {phaseStartedAt:now,phases:[...previous.phases,{phase:previous.phase,durationMs:Math.max(0,now-previous.phaseStartedAt)}].slice(-64)};
  useModelLoadStore.setState({...timing,phase,percent:percent!==null && Number.isFinite(percent)?Math.max(0,Math.min(100,percent)):null});
}
export function finishModelLoad(ticket:number):void {
  const state=useModelLoadStore.getState();
  if(state.ticket!==ticket || !state.active)return;
  const now=Date.now();
  useModelLoadStore.setState({active:false,percent:null,totalDurationMs:Math.max(0,now-state.startedAt),phases:[...state.phases,{phase:state.phase,durationMs:Math.max(0,now-state.phaseStartedAt)}].slice(-64)});
}
