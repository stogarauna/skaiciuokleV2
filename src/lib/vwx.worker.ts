import { readVwxScene } from './vwx-scene';

self.onmessage = async ({data}: MessageEvent<{file:File;readPanelRecords:boolean}>) => {
 try {
  const scene = await readVwxScene(data.file, percent => self.postMessage({type:'progress',percent}),{readPanelRecords:data.readPanelRecords});
  self.postMessage({type:'done',scene});
 } catch(error) {
  self.postMessage({type:'error',message:error instanceof Error ? error.message : 'Nepavyko nuskaityti VWX failo.'});
 }
};
