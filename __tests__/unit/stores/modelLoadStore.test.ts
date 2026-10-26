import {beginModelLoad,reportModelLoad,finishModelLoad,useModelLoadStore} from '../../../src/stores/modelLoadStore';

describe('model loading progress ownership',()=>{
  it('ignores late events and completion from a previous load',()=>{
    const first=beginModelLoad('text');
    const current=beginModelLoad('image');
    reportModelLoad(first,'Old progress',90);finishModelLoad(first);
    expect(useModelLoadStore.getState()).toMatchObject({active:true,type:'image',percent:null});
    reportModelLoad(current,'Preparing components');
    expect(useModelLoadStore.getState().phase).toBe('Preparing components');
    finishModelLoad(current);expect(useModelLoadStore.getState().active).toBe(false);
  });
  it('clamps measured progress and keeps unknown progress indeterminate',()=>{
    const ticket=beginModelLoad('text');reportModelLoad(ticket,'Loading',150);
    expect(useModelLoadStore.getState().percent).toBe(100);
    reportModelLoad(ticket,'Preparing',NaN);expect(useModelLoadStore.getState().percent).toBeNull();finishModelLoad(ticket);
  });
});

it('measures each phase once and keeps queue time separate',()=>{
  const clock=jest.spyOn(Date,'now').mockReturnValue(1000);
  const ticket=beginModelLoad('text','Waiting for model resource');
  clock.mockReturnValue(1100);reportModelLoad(ticket,'Checking model files');
  clock.mockReturnValue(1300);reportModelLoad(ticket,'Loading model file',25);
  clock.mockReturnValue(1400);reportModelLoad(ticket,'Loading model file',50);
  clock.mockReturnValue(1500);finishModelLoad(ticket);finishModelLoad(ticket);
  expect(useModelLoadStore.getState().phases).toEqual([
    {phase:'Waiting for model resource',durationMs:100},{phase:'Checking model files',durationMs:200},{phase:'Loading model file',durationMs:200},
  ]);
  expect(useModelLoadStore.getState().totalDurationMs).toBe(500);clock.mockRestore();
});
