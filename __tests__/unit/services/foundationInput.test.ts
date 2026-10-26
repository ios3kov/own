import { hasNewImageInput,boundedFoundationHistory } from '../../../src/services/foundationInput';

it('distinguishes a new user photo from generated image history', () => {
  const image: any = {id:'old',role:'assistant',content:'Generated',attachments:[{type:'image',uri:'file:///image.png'}]};
  const text: any = {id:'next',role:'user',content:'2+2'};
  expect(hasNewImageInput([image,text])).toBe(false);
  expect(hasNewImageInput([{...image,role:'user'},text])).toBe(false);
  expect(hasNewImageInput([text,{...image,role:'user'}])).toBe(true);
});

it('bounds only request history and retains system instructions plus the latest user request',()=>{
  const system:any={id:'s',role:'system',content:'Keep the instructions'};
  const history:any[]=Array.from({length:300},(_,i)=>({id:String(i),role:i%2===0?'user':'assistant',content:String(i)}));
  const latest:any={id:'latest',role:'user',content:'Latest request'};
  const original=JSON.stringify([system,...history,latest]);
  const result=boundedFoundationHistory([system,...history,latest]);
  expect(result.trimmed).toBe(true);expect(result.messages.length).toBeLessThanOrEqual(256);
  expect(result.messages[0]).toEqual(system);expect(result.messages[1].role).toBe('user');expect(result.messages.at(-1)).toEqual(latest);
  expect(JSON.stringify([system,...history,latest])).toBe(original);
});
