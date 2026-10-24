import logger from '../../../src/utils/logger';
describe('debug-only app diagnostics',()=>{
  const previous=(global as any).__DEV__;
  afterEach(()=>{(global as any).__DEV__=previous;jest.restoreAllMocks();});
  it.each(['log','warn','error'] as const)('suppresses %s in Release',level=>{
    (global as any).__DEV__=false;
    const output=jest.spyOn(console,level).mockImplementation(()=>{});
    logger[level]('Synthetic private diagnostic',{path:'/qa/private'});
    expect(output).not.toHaveBeenCalled();
  });
  it.each(['log','warn','error'] as const)('retains %s for explicit debug builds',level=>{
    (global as any).__DEV__=true;
    const output=jest.spyOn(console,level).mockImplementation(()=>{});
    logger[level]('Synthetic diagnostic');
    expect(output).toHaveBeenCalledWith('Synthetic diagnostic');
  });
});
