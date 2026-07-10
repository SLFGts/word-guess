type Props = { onPlay: () => void; onStats: () => void; onRules: () => void };
const modes = [
  { icon: "✏️", title: "普通模式", text: "随机词库，自由猜词", color: "#ffe8cc" },
  { icon: "⭐", title: "每日挑战", text: "每天一题，和全世界比", tag: "TODAY", color: "#d4f5d0" },
  { icon: "🎯", title: "主题专场", text: "成语/热词/影视分类", tag: "NEW", color: "#d0e4f7" },
];
export function HomePage({ onPlay, onStats, onRules }: Props) {
 return <section className="page home-page">
   <span className="star" style={{top:46,left:30}}>✦</span><span className="star" style={{top:78,right:38,color:"#c9a8e8"}}>◆</span>
   <div className="home-top"><div className="logo"><span>猜</span><i>词</i></div><p>输入一个词，看看离答案有多远~</p></div>
   <button className="doodle-button start-button" onClick={onPlay}>快速开始 <b className="pixel">▶</b></button>
   <p className="start-note">点击开始一场猜词冒险</p>
   <div className="recent doodle-card"><span>✏️</span><p><b>最近：苹果</b> · 8 次猜中 · 2分30秒</p><span>⭐</span></div>
   <div className="section-heading"><b>◆ 选择模式</b><button onClick={onStats}>我的战绩 →</button></div>
   <div className="mode-scroll">{modes.map((mode) => <button key={mode.title} className="mode-card" style={{background:mode.color}} onClick={onPlay}><span className="mode-icon">{mode.icon}</span>{mode.tag&&<em>{mode.tag}</em>}<strong>{mode.title}</strong><small>{mode.text}</small></button>)}</div>
   <button className="rules-trigger" onClick={onRules}>📖 玩法规则 <span>⌄</span></button>
   <div className="home-rule doodle-card"><b>怎么玩？</b><p>✏️ 输入词语，分数越高越接近答案！</p></div>
   <div className="wave">〰〰〰〰〰〰〰〰〰〰〰</div>
   <span className="star" style={{bottom:32,right:32,color:"#a3c4f3"}}>✦</span>
 </section>
}
