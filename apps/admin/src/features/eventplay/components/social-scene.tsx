'use client';
import { useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { LiveRoom } from '../api/realtime';
import {
  socialGames,
  socialInterests,
  socialTasks,
  socialQuestions,
  socialSymbols,
  type SocialVariant
} from '../api/social-games';
import {
  sendSocial,
  socialSelfQuery,
  socialAdminQuery,
  manageSocial,
  type SocialInput
} from '../api/social-service';
import { SocialArt } from './social-art';
import styles from './social-scene.module.css';
export function SocialPoster({ variant }: { variant: SocialVariant }) {
  return (
    <div
      className={styles.poster}
      style={{ backgroundImage: "url('" + socialGames[variant].background + "')" }}
    >
      <SocialArt variant={variant} />
    </div>
  );
}
export function SocialScene({ room }: { room: LiveRoom }) {
  const v = room.config.socialVariant ?? 'team',
    g = room.game?.social,
    info = socialGames[v];
  return (
    <section
      className={styles.scene}
      data-social-variant={v}
      style={{ backgroundImage: "url('" + info.background + "')" }}
    >
      <header>
        <span>{room.config.brand || 'EventPlay'} · 认识彼此，一起玩</span>
        <span>
          {g?.participants ?? 0} 人自愿参与 ·{' '}
          {room.state === 'waiting'
            ? '等待开场'
            : room.state === 'paused'
              ? '活动暂停'
              : g?.closed
                ? '本场已截止'
                : '破冰进行中'}
        </span>
      </header>
      <h2>{info.name}</h2>
      <p className={styles.intro}>{info.description}</p>
      <div className={styles.board}>
        {v === 'team' ? (
          <div className={styles.grid}>
            {(
              g?.groups ?? [
                { index: 0, members: 0, tasks: [false, false, false], sentences: 0 },
                { index: 1, members: 0, tasks: [false, false, false], sentences: 0 }
              ]
            ).map((group) => (
              <article className={styles.card} key={group.index}>
                <SocialArt variant={v} index={group.index} />
                <h3>{room.config.teams.split(',')[group.index] || '营地 ' + (group.index + 1)}</h3>
                <strong>{group.members} 位伙伴</strong>
                {socialTasks.map((t, i) => (
                  <p key={t}>
                    {group.tasks[i] ? '✓' : '○'} {t}
                  </p>
                ))}
              </article>
            ))}
          </div>
        ) : v === 'interest' ? (
          <div className={styles.grid}>
            {socialInterests.map((t, i) => (
              <article key={t} className={styles.card}>
                <SocialArt variant={v} index={i} />
                <h3>{t}小岛</h3>
                <strong>{g?.interests[i] ?? 0} 人</strong>
              </article>
            ))}
          </div>
        ) : v === 'bingo' ? (
          <div className={styles.hero}>
            <SocialArt variant={v} />
            <strong>{g?.bingoCompleted ?? 0} 位伙伴完成宾果</strong>
            <div className={styles.nine}>
              {socialInterests.map((t) => (
                <span key={t}>找到喜欢{t}的伙伴</span>
              ))}
            </div>
          </div>
        ) : ['truth', 'praise'].includes(v) ? (
          g?.posts.length ? (
            <div className={styles.grid}>
              {g.posts.map((p) => (
                <article key={p.id} className={styles.card}>
                  <SocialArt variant={v} />
                  {v === 'truth' ? (
                    <>
                      <ol>
                        {p.statements.map((s, i) => (
                          <li key={i}>
                            {s}
                            {p.lie === i ? ' · 这一条是假的' : ''}
                          </li>
                        ))}
                      </ol>
                      <p>{g.revealed ? '经历已揭晓' : '哪一条是假的？请在手机上作答'}</p>
                    </>
                  ) : (
                    <p>{p.text}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>等待伙伴提交与主持人审核</p>
          )
        ) : v === 'story' ? (
          <div className={styles.story}>
            {(g?.groups ?? []).map((group) => (
              <article key={group.index} className={styles.card}>
                <SocialArt variant={v} index={group.index} />
                <h3>{room.config.teams.split(',')[group.index]}的故事</h3>
                {g?.posts
                  .filter((p) => p.group === group.index)
                  .map((p, i) => (
                    <p key={p.id}>
                      {i + 1}. {p.text}
                    </p>
                  ))}
                {!group.sentences && <p>第一句话，会是什么呢？</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.hero}>
            <SocialArt variant={v} />
            <strong>{g?.connections ?? 0} 次双方确认</strong>
            <p>
              {v === 'cards'
                ? '名片信息只在双方手机私下展示'
                : v === 'match'
                  ? '答案仅在双方全部作答后私下揭晓'
                  : '找到伙伴，交流后再确认配对'}
            </p>
          </div>
        )}
      </div>
      <footer>
        <span>自愿参与 · 双向确认 · 不设个人输赢榜</span>
        <span>大屏不展示联系方式或未揭晓答案</span>
      </footer>
    </section>
  );
}
export function SocialPlayer({ room, connected }: { room: LiveRoom; connected: boolean }) {
  const { data } = useSuspenseQuery(socialSelfQuery(room.id)),
    client = useQueryClient();
  const v = room.config.socialVariant ?? 'team',
    g = room.game?.social;
  const [interests, setInterests] = useState<number[]>([0]),
    [contact, setContact] = useState(''),
    [code, setCode] = useState(''),
    [text, setText] = useState(''),
    [cell, setCell] = useState(0),
    [lie, setLie] = useState(0),
    [statements, setStatements] = useState(['', '', '']);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const enabled = connected && room.state === 'running' && !g?.closed,
    joined = data.profile?.active;
  async function act(body: SocialInput) {
    setBusy(true);
    setMessage('');
    try {
      await sendSocial(room.id, body);
      await client.invalidateQueries({ queryKey: ['social-self', room.id] });
      setMessage(body.action === 'leave' ? '已退出，配对和名片访问已撤销。' : '操作已记录。');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel}>
      <h3>{socialGames[v].name}</h3>
      <p>自愿参与，可随时退出。不想公开的信息请不要填写在故事或祝福中。</p>
      {!joined ? (
        <>
          <p>点击下方按钮即表示愿意参加本场破冰；不会自动交换联系方式。</p>
          {v === 'interest' && (
            <>
              <label>选择兴趣</label>
              <div className={styles.controls}>
                {socialInterests.map((t, i) => (
                  <Button
                    key={t}
                    variant={interests.includes(i) ? 'default' : 'outline'}
                    onClick={() =>
                      setInterests((old) =>
                        old.includes(i) ? old.filter((x) => x !== i) : [...old, i]
                      )
                    }
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </>
          )}
          {v === 'cards' && (
            <>
              <label htmlFor='social-contact'>自愿交换的信息（仅双向同意后可见）</label>
              <input
                id='social-contact'
                maxLength={100}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder='例如：称呼、业务介绍或自愿提供的联系方式'
              />
            </>
          )}
          <Button
            disabled={!enabled || busy}
            onClick={() => void act({ action: 'enroll', interests, contact })}
          >
            同意并加入破冰
          </Button>
        </>
      ) : (
        <>
          <p>你的破冰码（向希望交流的伙伴出示）</p>
          <div className={styles.code}>{data.profile?.code}</div>
          <p>所属营地：{room.config.teams.split(',')[data.profile?.group ?? 0]}</p>
          {v === 'same' && (
            <p className={styles.status}>
              你的秘密图案：{socialSymbols[data.profile?.symbol ?? 0]}
              。通过交流找到同款，不在大屏公开分配名单。
            </p>
          )}
          {v === 'team' && (
            <>
              <p>完成任务后各自确认；同组至少两位不同伙伴确认才算完成。</p>
              <div className={styles.controls}>
                {socialTasks.map((t, i) => (
                  <Button
                    key={t}
                    disabled={!enabled || busy || data.taskMine.includes(i)}
                    onClick={() => void act({ action: 'task', index: i })}
                  >
                    {data.taskMine.includes(i) ? '已确认 · ' : ''}
                    {t}
                  </Button>
                ))}
              </div>
            </>
          )}
          {['interest', 'match', 'same', 'bingo', 'cards', 'praise'].includes(v) && (
            <>
              <label htmlFor='social-code'>伙伴破冰码</label>
              <input
                id='social-code'
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder='请向现场伙伴询问'
              />
              {v === 'bingo' && (
                <>
                  <label htmlFor='social-cell'>请伙伴确认的条件</label>
                  <select
                    id='social-cell'
                    value={cell}
                    onChange={(e) => setCell(Number(e.target.value))}
                  >
                    {socialInterests.map((t, i) => (
                      <option key={t} value={i} disabled={data.bingo.includes(String(i))}>
                        喜欢{t}
                      </option>
                    ))}
                  </select>
                  <div className={styles.nine}>
                    {socialInterests.map((t, i) => (
                      <span key={t} data-done={data.bingo.includes(String(i))}>
                        {data.bingo.includes(String(i)) ? '✓ ' : ''}
                        {t}
                      </span>
                    ))}
                  </div>
                  <p>九个格子需要九位不同伙伴；对方应在条件真实符合时确认。</p>
                </>
              )}
              {v === 'praise' && (
                <>
                  <label htmlFor='social-praise'>送给伙伴的鼓励</label>
                  <textarea
                    id='social-praise'
                    maxLength={240}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </>
              )}
              <div className={styles.controls}>
                <Button
                  disabled={!enabled || busy || (!code && v !== 'interest')}
                  onClick={() => void act({ action: 'invite', code, text, index: cell })}
                >
                  {v === 'interest' && !code ? '寻找同好并发送邀请' : '向伙伴发送邀请'}
                </Button>
              </div>
              {v === 'cards' && <p>你填写的信息只会在对方同意后显示；可退出后重新填写。</p>}
            </>
          )}
          {v === 'match' && data.pairAnswers && (
            <>
              <h4>独立作答 · 提交后不能修改</h4>
              {socialQuestions.map((q, i) => (
                <div key={q.text} className={styles.request}>
                  <p>{q.text}</p>
                  <div className={styles.controls}>
                    {q.choices.map((c, j) => (
                      <Button
                        key={c}
                        variant={data.pairAnswers?.mine[String(i)] === j ? 'default' : 'outline'}
                        disabled={!enabled || busy || String(i) in data.pairAnswers!.mine}
                        onClick={() =>
                          void act({
                            action: 'answer',
                            id: data.pairAnswers?.id,
                            index: i,
                            choice: j
                          })
                        }
                      >
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {data.pairAnswers.ready ? (
                <div className={styles.private}>
                  <h4>
                    默契结果 · {data.pairAnswers.results.filter((r) => r.same).length} / 3 相同
                  </h4>
                  {data.pairAnswers.results.map((r) => (
                    <p key={r.question}>
                      {r.question} {r.answers.map((a) => r.choices[a]).join(' / ')} ·{' '}
                      {r.same ? '默契一致' : '发现彼此的不同'}
                    </p>
                  ))}
                </div>
              ) : (
                <p>双方全部作答后，才会展示彼此答案。</p>
              )}
            </>
          )}
          {v === 'truth' && (
            <>
              {!data.posts.length && (
                <>
                  <h4>两条真实经历＋一条虚构经历</h4>
                  {statements.map((s, i) => (
                    <div key={i}>
                      <label htmlFor={'truth-' + i}>经历 {i + 1}</label>
                      <input
                        id={'truth-' + i}
                        value={s}
                        maxLength={60}
                        onChange={(e) =>
                          setStatements((old) => old.map((t, j) => (i === j ? e.target.value : t)))
                        }
                      />
                    </div>
                  ))}
                  <label htmlFor='truth-lie'>哪一条是虚构的（暂时保密）</label>
                  <select
                    id='truth-lie'
                    value={lie}
                    onChange={(e) => setLie(Number(e.target.value))}
                  >
                    {[0, 1, 2].map((i) => (
                      <option key={i} value={i}>
                        第 {i + 1} 条
                      </option>
                    ))}
                  </select>
                  <div className={styles.controls}>
                    <Button
                      disabled={!enabled || busy}
                      onClick={() => void act({ action: 'post', statements, choice: lie })}
                    >
                      提交三条经历
                    </Button>
                  </div>
                </>
              )}
              {g?.posts
                .filter((p) => !data.posts.some((m) => m.id === p.id))
                .map((p) => (
                  <article className={styles.request} key={p.id}>
                    {p.statements.map((s, i) => (
                      <p key={i}>
                        {i + 1}. {s}
                      </p>
                    ))}
                    <div className={styles.controls}>
                      {[0, 1, 2].map((i) => (
                        <Button
                          key={i}
                          disabled={!enabled || busy || data.guessed.includes(p.id)}
                          onClick={() => void act({ action: 'guess', id: p.id, choice: i })}
                        >
                          猜第 {i + 1} 条是假
                        </Button>
                      ))}
                    </div>
                    {p.lie !== undefined && <p>揭晓：第 {p.lie + 1} 条是假的</p>}
                  </article>
                ))}
            </>
          )}
          {v === 'story' && (
            <>
              <p className={styles.status}>{data.myTurn ? '轮到你接下一句' : '正在等待队友接龙'}</p>
              <label htmlFor='social-story'>接上团队的故事</label>
              <textarea
                id='social-story'
                value={text}
                maxLength={240}
                onChange={(e) => setText(e.target.value)}
              />
              <div className={styles.controls}>
                <Button
                  disabled={!enabled || busy || !data.myTurn}
                  onClick={() => void act({ action: 'post', text })}
                >
                  提交接龙句子
                </Button>
              </div>
            </>
          )}
          {!!data.requests.length && (
            <>
              <h4>我的邀请与连接</h4>
              {data.requests
                .slice()
                .reverse()
                .map((r) => (
                  <article className={styles.request} key={r.id}>
                    <p>
                      {r.to === data.playerId ? '收到' : '发给'}伙伴 {r.otherCode} 的邀请 ·{' '}
                      {{
                        pending: '待回应',
                        accepted: '已同意',
                        declined: '已拒绝',
                        cancelled: '已取消',
                        expired: '已过期'
                      }[r.status] ?? r.status}
                    </p>
                    {r.kind === 'bingo' && (
                      <p>条件：你是否喜欢{socialInterests[r.index]}？请如实确认。</p>
                    )}
                    {r.text && <p>{r.text}</p>}
                    {r.contact && (
                      <div className={styles.private}>对方自愿交换的信息：{r.contact}</div>
                    )}
                    <div className={styles.controls}>
                      {r.status === 'pending' && r.to === data.playerId && (
                        <>
                          <Button
                            disabled={!enabled || busy}
                            onClick={() => void act({ action: 'accept', id: r.id })}
                          >
                            {r.kind === 'bingo' ? '确认，我符合条件' : '同意邀请'}
                          </Button>
                          <Button
                            variant='outline'
                            disabled={!enabled || busy}
                            onClick={() => void act({ action: 'decline', id: r.id })}
                          >
                            拒绝邀请
                          </Button>
                        </>
                      )}
                      {['pending', 'accepted'].includes(r.status) && (
                        <Button
                          variant='outline'
                          disabled={!enabled || busy}
                          onClick={() => void act({ action: 'cancel', id: r.id })}
                        >
                          取消连接
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
            </>
          )}
          {data.posts.map((p) => (
            <p className={styles.status} key={p.id}>
              我的内容：
              {{ pending: '等待主持人审核', approved: '已通过审核', hidden: '已隐藏' }[p.status] ??
                p.status}
            </p>
          ))}
          <div className={styles.controls}>
            <Button
              variant='outline'
              disabled={!connected || busy}
              onClick={() => void act({ action: 'leave' })}
            >
              退出破冰并撤销连接
            </Button>
          </div>
        </>
      )}
      {message && <p role='status'>{message}</p>}
    </section>
  );
}
export function SocialAdmin({ room }: { room: LiveRoom }) {
  const { data } = useSuspenseQuery(socialAdminQuery(room.id)),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function act(action: string, id?: string) {
    setBusy(true);
    setError('');
    try {
      await manageSocial(room.id, action, id);
      await client.invalidateQueries({ queryKey: ['social-admin', room.id] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = ['running', 'paused'].includes(room.state);
  return (
    <section className={styles.panel}>
      <h3>社交破冰控制</h3>
      <p>仅审核公开内容，不查看玩家联系方式或未揭晓的默契答案。夸夸需接收者同意后才能通过。</p>
      <div className={styles.controls}>
        <Button disabled={!active || busy || data.closed} onClick={() => void act('close')}>
          截止破冰互动
        </Button>
        {room.config.socialVariant === 'truth' && (
          <Button
            disabled={!active || busy || !data.closed || data.revealed}
            onClick={() => void act('reveal')}
          >
            揭晓所有经历
          </Button>
        )}
        <Button
          variant='outline'
          onClick={() => {
            const blob = new Blob(
              [
                JSON.stringify(
                  {
                    name: room.config.name,
                    variant: room.config.socialVariant,
                    summary: room.game?.social
                  },
                  null,
                  2
                )
              ],
              { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob),
              a = document.createElement('a');
            a.href = url;
            a.download = 'EventPlay-icebreakers.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          导出匿名汇总
        </Button>
      </div>
      {error && <p role='alert'>{error}</p>}
      <div className={styles.review}>
        {data.posts.map((p) => (
          <article key={p.id} className={styles.request}>
            <p>
              营地 {p.group + 1} · {p.status}
            </p>
            {p.statements.map((s, i) => (
              <p key={i}>
                {i + 1}. {s}
              </p>
            ))}
            <p>{p.text}</p>
            <div className={styles.controls}>
              <Button
                disabled={!active || busy || p.status === 'approved'}
                onClick={() => void act('approve', p.id)}
              >
                通过内容
              </Button>
              <Button
                variant='outline'
                disabled={!active || busy || p.status === 'hidden'}
                onClick={() => void act('hide', p.id)}
              >
                隐藏内容
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
