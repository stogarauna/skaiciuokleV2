import { readVwxScene } from './vwx-scene';

self.onmessage = async (event: MessageEvent<File>) => {
 try {
  const scene = await readVwxScene(event.data, percent => self.postMessage({type:'progress',percent}));
  self.postMessage({type:'done',scene});
 } catch(error) {
  self.postMessage({type:'error',message:error instanceof Error ? error.message : 'Nepavyko nuskaityti VWX failo.'});
 }
};
