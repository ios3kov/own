# Own performance validation

GGUF inference supports CPU and Metal. Initialization retries on CPU; a final retry keeps the requested context or reduces it. Core ML image generation has its own model and memory limits.

The tiny simulator model verifies execution and context measurement. It does not establish phone speed, sustained memory use, battery or thermal behavior. Record those measurements with the exact phone, OS, model, settings and signed artifact as described in the [phone checklist](privacy-and-phone-checks.md).
