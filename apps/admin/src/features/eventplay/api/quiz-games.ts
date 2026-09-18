export type QuizVariant = 'adventure' | 'boolean' | 'buzzer' | 'race' | 'picture' | 'clues' | 'tower' | 'boss';
const basic = 'EventPlay 的玩家从哪里加入？|扫码进入|修改服务器|安装数据库|联系开发者|A\n团队互动最重要的是什么？|共同参与|只有主持人操作|关闭网络|不看规则|A\n活动开始前应先做什么？|直接离场|检查设备与网络|关闭大屏|清空题库|B';
export const quizGames: Record<QuizVariant, { name: string; description: string; quizText: string; scene: string }> = {
  adventure: { name:'品牌知识闯关', description:'全员限时答题，答对贡献10分，沿探险地图逐关前进。', quizText:basic, scene:'岛屿探险' },
  boolean: { name:'欢乐判断王', description:'选择对或错，答对10分；答错不淘汰，继续挑战下一题。', quizText:'扫码可以加入本场互动。|对|错|不使用|不使用|A\n答错一道题就必须离场。|对|错|不使用|不使用|B\n开始前应检查现场网络。|对|错|不使用|不使用|A', scene:'综艺舞台' },
  buzzer: { name:'极速抢答王', description:'先抢资格再作答，服务端先收到者获得本题资格；答错或超时等下一题，不递补。', quizText:basic, scene:'聚光抢答席' },
  race: { name:'答题赛跑', description:'答对10分推动战队前进，时间结束按积分排名，不按作答速度计分。', quizText:basic, scene:'动物运动会' },
  picture: { name:'看图猜猜猜', description:'图片分三阶段揭开，选择正确答案得10分。', quizText:'图中是哪种运动的角色？|赛马|游泳|篮球|滑雪|A|/games/race/horse-cartoon-red-v2.png\n图中是哪一种场景？|海底|体育场|沙漠|太空|B|/games/race/stadium-cartoon-v2.png', scene:'趣味摄影棚' },
  clues: { name:'线索猜谜王', description:'线索逐条揭晓，三个阶段答对分别得30/20/10分；每题只提交一次。', quizText:'猜一种现场参与方式。|扫码|寄信|传真|打卡上班|A||不需要纸质报名表~用手机摄像头识别~对准现场二维码\n猜一种现场显示设备。|键盘|大屏|鼠标|耳机|B||全场都能看到~展示实时排名~主持人身后的显示画面', scene:'宝箱谜题岛' },
  tower: { name:'团队智慧塔', description:'每次答对贡献10分、增加一层智慧塔，结束按团队总分排名。', quizText:basic, scene:'云端建筑工地' },
  boss: { name:'全场答题打 Boss', description:'答对贡献10点伤害，全场合力破盾；时间结束达到目标即挑战成功。', quizText:basic, scene:'童话冒险竞技场' }
};
