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
