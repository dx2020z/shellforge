export interface PartAsset {
  id: string;
  previewPath: string;
  modelPath: string|null;
  version: number;
  source: 'placeholder'|'preset'|'generated';
}

export const PART_ASSETS: Record<string, PartAsset> = {
  h01:{id:'h01',previewPath:'/assets/parts/h01.svg',modelPath:null,version:1,source:'placeholder'},
  h02:{id:'h02',previewPath:'/assets/parts/h02.svg',modelPath:null,version:1,source:'placeholder'},
  h03:{id:'h03',previewPath:'/assets/parts/h03.svg',modelPath:null,version:1,source:'placeholder'},
  b01:{id:'b01',previewPath:'/assets/parts/b01.svg',modelPath:null,version:1,source:'placeholder'},
  b02:{id:'b02',previewPath:'/assets/parts/b02.svg',modelPath:null,version:1,source:'placeholder'},
  b03:{id:'b03',previewPath:'/assets/parts/b03.svg',modelPath:null,version:1,source:'placeholder'},
  l01:{id:'l01',previewPath:'/assets/parts/l01.svg',modelPath:null,version:1,source:'placeholder'},
  l02:{id:'l02',previewPath:'/assets/parts/l02.svg',modelPath:null,version:1,source:'placeholder'},
  l03:{id:'l03',previewPath:'/assets/parts/l03.svg',modelPath:null,version:1,source:'placeholder'},
};

export function getPartAsset(id:string):PartAsset {
  const asset = PART_ASSETS[id];
  if (!asset) throw new Error(`Missing asset manifest entry: ${id}`);
  return asset;
}
