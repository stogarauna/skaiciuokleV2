export const panelFields=[
 {key:'widthM',label:'Plotis, m',min:0.0001,max:10,required:true},
 {key:'heightM',label:'Aukštis, m',min:0.0001,max:10,required:true},
 {key:'depthM',label:'Storis, m',min:0.0001,max:10,required:false},
 {key:'resX',label:'Plotis, px',min:1,max:16384,required:true,integer:true},
 {key:'resY',label:'Aukštis, px',min:1,max:16384,required:true,integer:true},
 {key:'weightKg',label:'Svoris, kg',min:0,max:1000,required:false},
 {key:'power',label:'Galia, W',min:0,max:50000,required:false},
 {key:'frameHeightM',label:'Rėmo aukštis, m',min:0,max:10,required:false},
 {key:'frameHeightMinM',label:'Min. rėmo aukštis, m',min:0,max:10,required:false},
 {key:'frameHeightMaxM',label:'Maks. rėmo aukštis, m',min:0,max:10,required:false},
 {key:'frameHalfKg',label:'0,5 m pakabinimo rėmas, kg',min:0,max:1000,required:false},
 {key:'frame1Kg',label:'1 m pakabinimo rėmas, kg',min:0,max:1000,required:false}
] as const;
