import { create } from 'zustand';
interface ModelLoadState {
  ticket: number; active: boolean; type: 'text' | 'image' | null; phase: string; percent: number | null;
}
export const useModelLoadStore = create<ModelLoadState>(() => ({ticket:0,active:false,type:null,phase:'Preparing model',percent:null}));
export function beginModelLoad(type: 'text' | 'image'): number {
  const ticket=useModelLoadStore.getState().ticket+1;
  useModelLoadStore.setState({ticket,active:true,type,phase:'Checking model files',percent:null});return ticket;
}
export function reportModelLoad(ticket: number, phase: string, percent: number | null = null): void {
  if (!useModelLoadStore.getState().active || useModelLoadStore.getState().ticket!==ticket) return;
  useModelLoadStore.setState({phase,percent:percent!==null && Number.isFinite(percent)?Math.max(0,Math.min(100,percent)):null});
}
export function finishModelLoad(ticket:number):void {
  if(useModelLoadStore.getState().ticket===ticket)useModelLoadStore.setState({active:false,percent:null});
}
