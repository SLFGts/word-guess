// pages/result/result.js
// 结算页：展示猜中后的成绩和庆祝动画

Page({
  data: {
    // 游戏成绩数据（从游戏页传入）
    targetWord: '',            // 目标词
    targetChars: [],           // 目标词拆字数组，供 wxml 逐字渲染彩色卡片
    safeTop: 20,               // 顶部安全区(px)：胶囊按钮底部 + 间距
    guessCount: 0,             // 猜测次数
    maxScore: 0,               // 最高相关度（数值，用于计算）
    maxScoreDisplay: '0.00',   // 最高相关度（字符串，用于显示）
    totalTime: '0:00',         // 总用时
    hintUsed: '0/3',           // 提示使用
    praise: '',                // 趣味评价
    won: false,                // 是否猜中（true=胜利，false=放弃）
    scoreHistory: [],          // 真实猜测得分序列：[{score, order}]
    chartWidth: 0              // Canvas 实际宽度（px），支持水平滚动
  },

  onLoad(options) {
    // 顶部安全区高度（navigationStyle:custom）
    this.setData({ safeTop: getApp().globalData.safeTop || 20 });
    // 从游戏页接收数据
    if (options.data) {
      const gameData = JSON.parse(decodeURIComponent(options.data));
      const word = gameData.targetWord || '';
      this.setData({
        targetWord: word,
        targetChars: word ? word.split('') : [],
        guessCount: gameData.guessCount || 0,
        maxScore: parseFloat((gameData.maxScore || 0).toFixed(2)),
        maxScoreDisplay: (gameData.maxScore || 0).toFixed(2),
        totalTime: gameData.totalTime || '0:00',
        hintUsed: gameData.hintUsed || '0/3',
        mode: gameData.mode || 'normal',   // 接收模式，供"再来一局"使用
        won: gameData.won || false,
        praise: this.getPraise(gameData.guessCount || 0),
        scoreHistory: gameData.scoreHistory || []
      });
    }
  },

  /** 页面就绪后绘制分数曲线（字体已在 app.js / game.js 预加载） */
  onReady() {
    this._ensureFontAndDraw();
  },

  /** 确保字体加载完成后再绘制，若已加载则立即绘制 */
  _ensureFontAndDraw() {
    const app = getApp();
    const status = app.globalData.fontsLoaded && app.globalData.fontsLoaded.ZCOOL;

    if (status === true || status === false) {
      // 字体已加载完成（成功或失败），直接绘制
      this.drawScoreChart();
    } else {
      // 字体仍在加载中，轮询等待（不重新调 loadFontFace，避免回调延迟）
      let tries = 0;
      const timer = setInterval(() => {
        const s = app.globalData.fontsLoaded && app.globalData.fontsLoaded.ZCOOL;
        if (s !== undefined || tries > 20) {
          clearInterval(timer);
          this.drawScoreChart();
        }
        tries++;
      }, 50);
    }
  },

  /** 用 Canvas 2D 绘制逼近路径曲线（从真实猜测数据生成坐标点，显示词和分数） */
  drawScoreChart() {
    const query = wx.createSelectorQuery();
    query.select('#scoreChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        const history = this.data.scoreHistory;
        if (!history || history.length === 0) return;

        const minPointSpacing = 70;
        const padding = { top: 45, right: 40, bottom: 45, left: 40 };
        const containerWidth = res[0].width;
        const points = this._scoreHistoryToPoints(history, minPointSpacing, padding.left);
        const rightmostX = points[points.length - 1].x + padding.right;
        const neededWidth = Math.max(containerWidth, rightmostX);

        this.setData({ chartWidth: neededWidth });

        canvas.width = neededWidth * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        const h = res[0].height;
        const chartH = h - padding.top - padding.bottom;
        const sy = chartH / 100;
        const wordFontSize = 14;
        const scoreFontSize = 12;

        ctx.font = `${wordFontSize}px "ZCOOL", "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + points[0].y * sy);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, padding.top + points[i].y * sy);
        }
        ctx.strokeStyle = '#3A3A3A';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + points[0].y * sy);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, padding.top + points[i].y * sy);
        }
        ctx.strokeStyle = '#FFB347';
        ctx.lineWidth = 3;
        ctx.stroke();

        points.forEach((p, i) => {
          const isLast = i === points.length - 1;
          const isWin = this.data.won && isLast;
          const x = p.x;
          const y = padding.top + p.y * sy;
          const item = history[i];

          const textColor = isWin ? '#A8E6A3' : '#3A3A3A';
          const dotColor = isWin ? '#A8E6A3' : '#FFB347';
          const dotBorderColor = isWin ? '#6BC46B' : '#E8953A';

          ctx.font = `${wordFontSize}px ZCOOL, "PingFang SC", sans-serif`;
          ctx.fillStyle = textColor;
          ctx.fillText(item.word || '', x, y - 18);

          ctx.font = `${scoreFontSize}px ZCOOL, "PingFang SC", sans-serif`;
          ctx.fillStyle = textColor;
          ctx.fillText(`${item.scoreDisplay || '0.00'}%`, x, y + 18);

          ctx.beginPath();
          ctx.arc(x, y, isWin ? 8 : 5, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();
          ctx.strokeStyle = dotBorderColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      });
  },

  /** 将猜测得分序列映射为坐标点（按固定 px 间距排列） */
  _scoreHistoryToPoints(history, spacing, leftPad) {
    const count = history.length;
    if (count === 0) return [];

    return history.map((item, i) => {
      const x = count === 1 ? leftPad + 50 : leftPad + i * spacing;
      const y = 100 - Math.min(Math.max(item.score, 0), 100);
      return { x, y, score: item.score };
    });
  },

  /** 根据猜测次数返回趣味评价 */
  getPraise(count) {
    if (count <= 0) return '';
    if (count <= 3) return '⚡ 直觉型选手！';
    if (count <= 6) return '⭐ 逻辑大师！';
    if (count <= 10) return ' 不错不错~';
    return ' 坚持就是胜利！';
  },

  /** 再来一局：重置游戏 */
  onPlayAgain() {
    const mode = this.data.mode || 'normal';
    wx.redirectTo({
      url: `/pages/game/game?mode=${mode}`
    });
  },

  /** 返回首页 */
  onGoHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
