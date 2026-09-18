export type WallVariant='avatars'|'logo'|'wishes'|'photos'|'barrage'|'garden'|'cities'|'welcome'|'stars';
export const wallGames:Record<WallVariant,{name:string;description:string;background:string;symbol:string}>={
 avatars:{name:'欢乐头像签到',description:'一次入场即签到，选择卡通头像，全场来宾汇聚大屏。',background:'/games/click/stage-bg-v1.png',symbol:'●'},
 logo:{name:'品牌 Logo 拼合',description:'每次签到点亮一块品牌拼图，达到预计人数后完整展示。',background:'/games/click/stage-bg-v1.png',symbol:'▦'},
 wishes:{name:'星愿祝福墙',description:'提交祝福，主持人审核后以明信片展示。',background:'/games/click/garden-bg-v1.png',symbol:'♥'},
 photos:{name:'现场照片墙',description:'上传照片和寄语，压缩并审核后汇成现场相册。',background:'/games/click/garden-bg-v1.png',symbol:'▧'},
 barrage:{name:'欢乐弹幕',description:'自由文字审核后，以轻快卡通气泡滚动上墙。',background:'/games/click/carnival-bg-v1.png',symbol:'…'},
 garden:{name:'签到种花园',description:'每位来宾成为一朵花，选择头像颜色，共同种出花海。',background:'/games/click/garden-bg-v1.png',symbol:'✿'},
 cities:{name:'城市足迹地图',description:'选择来源城市，点亮城市分布示意图，不采集定位。',background:'/games/race/illustrated/yacht-bg-v2.png',symbol:'⌖'},
 welcome:{name:'欢迎登场秀',description:'卡通聚光舞台轮流欢迎来宾，可暂停展示。',background:'/games/click/stage-bg-v1.png',symbol:'★'},
 stars:{name:'全场点亮星空',description:'签到后点击点亮专属星星，每人一次，全场合力完成星空。',background:'/games/race/illustrated/spaceship-bg-v2.png',symbol:'✦'}
};
export const wallCities=['北京','上海','广州','深圳','杭州','成都','武汉','西安','南京','重庆','其他'];
export interface WallPost {id:string;playerId:string;name:string;text:string;photo:string;status:'pending'|'approved'|'hidden';pinned:boolean}
export interface WallState {posts:WallPost[];hidden:boolean;paused:boolean;variant?:WallVariant}
