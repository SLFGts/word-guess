// pages/game/game.js
// 游戏页：核心猜词界面，沉浸式心流体验
// 设计原则：所有 UI 服务于"降低思考成本，让玩家专注于猜"

const api = require('../../utils/api');

Page({
  data: {
    safeTop: 20,             // 顶部安全区(px)：胶囊按钮底部 + 间距，由 app.js 计算

    // 游戏状态
    gameId: '',
    mode: 'normal',           // normal / daily / theme
    similarityMode: 'vector', // vector 或 embedding（从 newGame 返回）
    targetWord: '',           // 目标词（胜利时=猜中的词，放弃时从云函数获取）
    guessCount: 0,            // 当前猜测次数
    wordLen: 0,               // 目标词字数
    startTime: 0,             // 游戏开始时间戳

    // 输入
    word: '',

    // 分数/相似度（统一百分数，保留两位小数）
    score: 0,                 // 数值，用于比较和心形计算
    scoreDisplay: '0.00',     // 字符串，用于界面显示
    similarity: 0,            // Mode B: 原始余弦相似度（内部用）
    scoreHint: '输入一个词开始猜~',
    scoreColor: '#A3C4F3',    // 分数/反馈文字颜色
    maxScore: 0,              // 当前最高分（用于放弃弹窗显示）

    // 计时
    timeDisplay: '0:00',      // 格式化的计时文字
    _timer: null,             // setInterval 句柄（内部用）

    // 猜测历史
    guesses: [],             // 全部猜测（按猜测顺序）
    top3Guesses: [],         // 按分数升序排列的前3条，用于页面展示

    // 完整记录弹窗
    historyOpen: false,      // 完整记录弹窗开关
    sortedGuesses: [],       // 按分数升序排列的全部猜测，用于弹窗展示

    // 提示状态（4层递进：类别→范围→特征→问答）
    t1: '',                   // T1 类别提示（直接展示在字数后，预生成）
    t2: '',                   // T2 范围提示（按钮1）
    t3: '',                   // T3 特征提示（按钮2）
    qa: '',                   // T4 问答裁判回答（按钮3）
    t2Used: false,            // T2 是否已使用
    t3Used: false,            // T3 是否已使用
    hintText: '',             // 当前显示的提示文字（保留兼容）
    hints: [],                // 提示列表：每次追加，不再覆盖
    askingQuestion: false,    // 是否处于提问模式（第三次提示）

    // 弹窗
    quitOpen: false,          // 放弃确认弹窗
    giveupOpen: false,        // 放弃结算弹窗
    giveupTarget: '',         // 放弃时显示的目标词
    giveupMaxScore: 0,        // 放弃时的最高分
    swipeBackIntercept: true, // page-container 开关：true 时拦截返回

    // 内部计数
    _orderCounter: 0,         // 猜测序号计数器（每次有效猜测 +1）
    _fontPreloaded: false,    // ZCOOL 字体是否已在本页预加载

    // 加载状态
    loading: false,
    loadingText: '加载中...'
  },

  onLoad(options) {
    this.setData({ safeTop: getApp().globalData.safeTop || 20 });
    const mode = options.mode || 'normal';
    this.setData({ mode, startTime: Date.now() });
    this.startGame(mode);
  },

  /** 开始新游戏 */
  async startGame(mode) {
    this.setData({ loading: true, loadingText: '开局中...' });
    try {
      // 调用云函数开局
      const res = await api.newGame(mode);

      // 云函数返回 { gameId, len, similarityMode, t1 }
      const gameId = res.gameId;
      const wordLen = res.len;
      const similarityMode = res.similarityMode || 'vector';
      const t1 = res.t1 || '';  // 类别提示（LLM 预生成，可能为 null）

      // 清除旧计时器，启动新计时
      if (this.data._timer) clearInterval(this.data._timer);
      const startTime = Date.now();
      this.setData({
        gameId,
        wordLen,
        similarityMode,
        t1,                     // 类别提示直接展示
        targetWord: '',
        startTime,              // 更新开始时间，供 _getGameData 计时使用
        _orderCounter: 0,       // 重置猜测序号
        guessCount: 0,
        guesses: [],
        top3Guesses: [],
        historyOpen: false,
        sortedGuesses: [],
        score: 0,
        scoreDisplay: '0.00',
        similarity: 0,
        scoreHint: '输入一个词开始猜~',
        scoreColor: '#A3C4F3',
        maxScore: 0,
        t2: '', t3: '', qa: '',
        t2Used: false, t3Used: false,
        hintText: '',
        hints: [],
        askingQuestion: false,
        timeDisplay: '0:00',
        loading: false,
        swipeBackIntercept: true  // 重新开始时恢复拦截
      });

      // 启动计时器，每秒更新
      this.data._timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        this.setData({ timeDisplay: `${minutes}:${seconds.toString().padStart(2, '0')}` });
      }, 1000);
    } catch (err) {
      console.error('开局失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '开局失败，请重试', icon: 'none' });
    }
  },

  /** 输入事件 */
  onInput(e) {
    this.setData({ word: e.detail.value });
  },

  /** 猜词提交 */
  async onGuess() {
    const word = this.data.word.trim();
    if (!word) return;

    // 校验长度
    if (word.length > 10) {
      wx.showToast({ title: '猜测不能超过10个字', icon: 'none' });
      return;
    }

    // 检查是否已猜过
    if (this.data.guesses.find(g => g.word === word)) {
      wx.showToast({ title: '已经猜过这个词了', icon: 'none' });
      this.setData({ word: '' });
      return;
    }

    // 首次猜测时预加载 ZCOOL 字体（供 result 页 Canvas 使用，避免结算时等待）
    this._preloadFont();

    this.setData({ loading: true, loadingText: '计算中...' });

    try {
      // 调用云函数计算相似度
      const res = await api.guess(this.data.gameId, word);

      // 根据模式处理不同返回格式
      if (this.data.similarityMode === 'embedding') {
        // Mode B: { similarity: 0.7234, won: false } 或 { error: '...' }
        if (res.error) {
          this.setData({ loading: false, word: '' });
          wx.showToast({ title: res.error, icon: 'none' });
          return;
        }

        const similarity = res.similarity;
        const won = res.won;

        const color = this._similarityColor(similarity);
        const hint = this._similarityHint(similarity);
        const score = parseFloat((similarity * 100).toFixed(2));
        const scoreDisplay = score.toFixed(2);
        const barColor = this._progressBarColor(score);

        const newOrder = this.data._orderCounter + 1;
        const newGuess = {
          word,
          similarity,
          score,
          scoreDisplay,
          barColor,
          order: newOrder,
          isBest: false  // 后面统一重算
        };
        const guesses = [...this.data.guesses, newGuess];

        const maxSim = Math.max(...guesses.map(g => g.similarity));
        guesses.forEach(g => g.isBest = g.similarity === maxSim);

        // 计算当前最高分（百分数）
        const currentMaxScore = parseFloat((maxSim * 100).toFixed(2));

        const update = {
          word: '',
          similarity,
          score,
          scoreDisplay,
          scoreHint: hint,
          scoreColor: color,
          guesses,
          top3Guesses: this._getTop3Guesses(guesses),
          guessCount: guesses.length,
          _orderCounter: newOrder,
          maxScore: currentMaxScore,
          loading: false
        };

        if (won || similarity >= 0.99) {
          update.targetWord = word;  // 猜中的词即为目标词
          this.setData(update);
          this._stopTimer();
          this._saveGameResult(true);
          setTimeout(() => {
            const gameData = this._getGameData();
            wx.redirectTo({
              url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(gameData))}`
            });
          }, 800);
          return;
        }

        this.setData(update);
      } else {
        // Mode A: { score: 78.8, won: false } 或 { score: null, message: '...' }
        if (res.score === null) {
          this.setData({ loading: false, word: '' });
          wx.showToast({ title: res.message || '词库里没有这个词', icon: 'none' });
          return;
        }

        const score = parseFloat(res.score.toFixed(2));
        const scoreDisplay = score.toFixed(2);
        const won = res.won;

        const color = this._scoreColor(score);
        const hint = this._scoreHint(score);
        const barColor = this._progressBarColor(score);

        const newOrder = this.data._orderCounter + 1;
        const newGuess = {
          word,
          score,
          scoreDisplay,
          barColor,
          order: newOrder,
          isBest: false  // 后面统一重算
        };
        const guesses = [...this.data.guesses, newGuess];

        const maxScore = Math.max(...guesses.map(g => g.score));
        guesses.forEach(g => g.isBest = g.score === maxScore);

        const update = {
          word: '',
          score,
          scoreDisplay,
          scoreHint: hint,
          scoreColor: color,
          guesses,
          top3Guesses: this._getTop3Guesses(guesses),
          guessCount: guesses.length,
          _orderCounter: newOrder,
          maxScore: parseFloat(maxScore.toFixed(2)),
          loading: false
        };

        if (won || score === 100) {
          update.targetWord = word;  // 猜中的词即为目标词
          this.setData(update);
          this._stopTimer();
          this._saveGameResult(true);
          setTimeout(() => {
            const gameData = this._getGameData();
            wx.redirectTo({
              url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(gameData))}`
            });
          }, 800);
          return;
        }

        this.setData(update);
      }
    } catch (err) {
      console.error('猜词失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '猜词失败', icon: 'none' });
    }
  },

  /** 获取提示（单按钮循环：T2范围→T3特征→T4问答） */
  async onHint() {
    // 如果正在提问模式，取消提问，恢复普通输入
    if (this.data.askingQuestion) {
      this.setData({ askingQuestion: false, word: '' });
      return;
    }

    // 自动判断下一级提示（T1 类别始终展示，按钮从 T2 开始）
    let level;
    if (!this.data.t2Used) level = 1;        // T2 范围提示
    else if (!this.data.t3Used) level = 2;   // T3 特征提示
    else if (!this.data.qa) level = 3;       // T4 进入问答模式
    else {
      wx.showToast({ title: '提示已用完', icon: 'none' });
      return;
    }

    // 前两次按钮提示（范围/特征）直接获取
    if (level <= 2) {
      this.setData({ loading: true, loadingText: '获取提示中...' });

      try {
        const res = await api.getHint(this.data.gameId, level);

        const update = { loading: false };

        if (level === 1) {
          update.t2 = res.hint || '';
          update.t2Used = true;
          update.hintText = res.hint || '';
          update.hints = [...this.data.hints, { type: '范围', text: res.hint || '' }];
        } else if (level === 2) {
          update.t3 = res.hint || '';
          update.t3Used = true;
          update.hintText = res.hint || '';
          update.hints = [...this.data.hints, { type: '特征', text: res.hint || '' }];
        }

        this.setData(update);
      } catch (err) {
        console.error('获取提示失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '获取提示失败', icon: 'none' });
      }
    } else {
      // 第三次按钮：进入提问模式
      this.setData({ askingQuestion: true, word: '' });
    }
  },

  /** 提问裁判（第四次提示：基于前三条提示提问） */
  async onAsk() {
    const question = this.data.word.trim();
    if (!question) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }

    // 校验长度
    if (question.length > 30) {
      wx.showToast({ title: '提问不能超过30个字', icon: 'none' });
      return;
    }

    // 检查是否已有三条提示（类别始终有，需检查范围+特征）
    if (!this.data.t2 || !this.data.t3) {
      wx.showToast({ title: '请先查看全部提示，再向裁判提问', icon: 'none' });
      return;
    }

    // 检查问答是否已使用
    if (this.data.qa) {
      wx.showToast({ title: '提问机会已用完', icon: 'none' });
      return;
    }

    this.setData({ loading: true, loadingText: '裁判思考中...' });

    try {
      const res = await api.getHint(this.data.gameId, 3, question);

      const answer = res.answer || '';

      this.setData({
        qa: answer,
        hintText: answer,
        askingQuestion: false,
        word: '',
        hints: [...this.data.hints, { type: '问答', text: answer }],
        loading: false
      });
    } catch (err) {
      console.error('提问失败:', err);
      this.setData({ loading: false, askingQuestion: false });
      wx.showToast({ title: err.message || '提问失败', icon: 'none' });
    }
  },

  /** 打开放弃确认弹窗 */
  onOpenQuit() {
    this.setData({ quitOpen: true });
  },

  /** 关闭放弃确认弹窗（继续游戏） */
  onCloseQuit() {
    this.setData({ quitOpen: false });
  },

  /** 确认放弃：获取答案后显示放弃结算弹窗 */
  async onConfirmQuit() {
    this.setData({ quitOpen: false, loading: true, loadingText: '获取答案中...' });

    // 计算当前最高分（百分数，两位小数）
    const maxScore = parseFloat(
      Math.max(...this.data.guesses.map(g => g.score || 0), 0).toFixed(2)
    );

    try {
      // 获取目标词用于结算展示
      const res = await api.getAnswer(this.data.gameId);
      const target = res.target || '未知';
      this._stopTimer();  // 停止计时
      this.setData({
        giveupOpen: true,
        giveupTarget: target,
        giveupMaxScore: maxScore,
        targetWord: target,    // 保存到 targetWord 供 _getGameData 使用
        loading: false
      });
      // 放弃的局也记录到历史
      this._saveGameResult(false);
    } catch (err) {
      console.error('获取答案失败:', err);
      // 失败则直接返回首页
      wx.navigateBack();
    }
  },

  /** 放弃后再来一局 */
  onGiveupPlayAgain() {
    this.setData({ giveupOpen: false });
    this.setData({ startTime: Date.now() });
    this.startGame(this.data.mode);
  },

  /** 放弃后返回首页 */
  onGiveupGoHome() {
    this.setData({ giveupOpen: false });
    wx.reLaunch({ url: '/pages/index/index' });
  },

  /** 返回首页 */
  onGoHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  /** 停止计时器 */
  _stopTimer() {
    if (this.data._timer) {
      clearInterval(this.data._timer);
      this.setData({ _timer: null });
    }
  },

  /** 页面卸载时清除计时器 */
  onUnload() {
    this._stopTimer();
  },

  /**
   * 侧滑/物理返回键/navigateBack 触发前
   * page-container 会自动关闭（内容消失），但我们立刻弹出确认弹窗遮住
   */
  onSwipeBackBeforeLeave() {
    if (this.data.quitOpen || this.data.giveupOpen) return;
    this.setData({ quitOpen: true });
  },

  /**
   * page-container 关闭后立刻重新打开，让内容恢复显示
   * duration=0 所以瞬间完成，加上弹窗遮罩层遮住，用户感知不到闪烁
   */
  onSwipeBackAfterLeave() {
    this.setData({ swipeBackIntercept: true });
  },

  /** 根据分数返回颜色（Mode A） */
  _scoreColor(score) {
    if (score >= 75) return '#A8E6A3';  // 薄荷绿
    if (score >= 30) return '#FFB347';  // 暖橙
    return '#A3C4F3';                    // 天蓝
  },

  /** 根据相似度返回颜色（Mode B） */
  _similarityColor(similarity) {
    if (similarity >= 0.6) return '#A8E6A3';  // 薄荷绿
    if (similarity >= 0.3) return '#FFB347';  // 暖橙
    return '#A3C4F3';                          // 天蓝
  },

  /** 根据分数返回反馈文案（参考图风格） */
  _scoreHint(score) {
    if (score >= 80) return '快猜中了！';
    if (score >= 60) return '更接近了！';
    if (score >= 40) return '有点接近了';
    if (score >= 20) return '方向对了！再试试';
    return '还差得远呢';
  },

  /** 根据相似度返回反馈文案（参考图风格） */
  _similarityHint(similarity) {
    if (similarity >= 0.8) return '快猜中了！';
    if (similarity >= 0.6) return '更接近了！';
    if (similarity >= 0.4) return '有点接近了';
    if (similarity >= 0.2) return '方向对了！再试试';
    return '还差得远呢';
  },

  /** 根据分数生成进度条颜色（由低到高：红→橙→黄→蓝→紫→绿） */
  _progressBarColor(score) {
    if (score >= 80) return '#A8E6A3';   // 薄荷绿
    if (score >= 60) return '#C9A8E8';   // 淡紫
    if (score >= 40) return '#A3C4F3';   // 天蓝
    if (score >= 20) return '#FFB347';   // 暖橙
    return '#E87070';                     // 浅红
  },

  /** 获取按分数降序排列的前3条记录（用于页面展示：从高到低） */
  _getTop3Guesses(guesses) {
    return [...guesses]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  },

  /** 打开完整记录弹窗（按猜测时间倒序展示，最后一次在最上面） */
  onOpenHistory() {
    this.setData({ historyOpen: true, sortedGuesses: [...this.data.guesses].reverse() });
  },

  /** 关闭完整记录弹窗 */
  onCloseHistory() {
    this.setData({ historyOpen: false });
  },

  /** 根据分数生成心形显示字符串（满分5颗心） */
  _hearts(pct) {
    const filled = Math.round(pct / 20);
    return '❤️'.repeat(Math.min(filled, 5)) + '🤍'.repeat(Math.max(5 - filled, 0));
  },

  /** 根据分数返回反馈文案颜色 */
  _feedbackColor(pct) {
    if (pct >= 80) return '#75C875';
    if (pct >= 60) return '#F49C2A';
    if (pct >= 40) return '#FFB347';
    return '#8A8578';
  },

  /** 保存游戏结果到本地存储（胜利和放弃均记录） */
  _saveGameResult(isWon) {
    const history = wx.getStorageSync('gameHistory') || [];
    const gameData = this._getGameData();
    gameData.won = !!isWon;           // 标记是否猜中
    gameData.date = Date.now();        // 时间戳，供统计页日期显示

    history.unshift(gameData);
    wx.setStorageSync('gameHistory', history.slice(0, 50)); // 最多保留 50 条

    // 更新统计（仅胜利局计入胜场和用时）
    const stats = wx.getStorageSync('gameStats') || { totalGames: 0, totalGuesses: 0, totalWins: 0, totalTimeSeconds: 0 };
    stats.totalGames++;
    if (isWon) {
      stats.totalWins = (stats.totalWins || 0) + 1;
      stats.totalGuesses += gameData.guessCount;
      stats.avgGuesses = (stats.totalGuesses / stats.totalWins).toFixed(1);
      stats.totalTimeSeconds = (stats.totalTimeSeconds || 0) + (gameData.totalSeconds || 0);
      stats.avgTimeSeconds = Math.round(stats.totalTimeSeconds / stats.totalWins);
    }
    stats.winRate = stats.totalGames > 0
      ? ((stats.totalWins || 0) / stats.totalGames * 100).toFixed(0)
      : '0';
    wx.setStorageSync('gameStats', stats);
  },

  /** 预加载 ZCOOL 字体（首次猜测时触发，供 result 页 Canvas 直接使用） */
  _preloadFont() {
    if (this._fontPreloaded) return;
    this._fontPreloaded = true;
    const app = getApp();
    if (app.globalData.fontsLoaded && app.globalData.fontsLoaded.ZCOOL) return;
    wx.loadFontFace({
      family: 'ZCOOL',
      source: 'url("https://cdn.jsdelivr.net/gh/SLFGts/word-guess@main/miniprogram/assets/fonts/ZCOOLKuaiLe-Regular.woff2")',
      success: () => { app.globalData.fontsLoaded = app.globalData.fontsLoaded || {}; app.globalData.fontsLoaded.ZCOOL = true; },
      fail: () => { app.globalData.fontsLoaded = app.globalData.fontsLoaded || {}; app.globalData.fontsLoaded.ZCOOL = false; }
    });
  },

  /** 获取游戏数据用于结算页 */
  _getGameData() {
    const elapsed = Math.floor((Date.now() - this.data.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    // 统一使用百分数数值（两个模式都已转为百分数）
    const maxScore = parseFloat(
      Math.max(...this.data.guesses.map(g => g.score || 0), 0).toFixed(2)
    );

    return {
      targetWord: this.data.targetWord || '未知',
      won: this.data.targetWord !== '' && this.data.targetWord !== '未知',
      guessCount: this.data.guesses.length,
      maxScore,
      similarityMode: this.data.similarityMode,
      mode: this.data.mode,   // 游戏模式，供"再来一局"传参
      totalTime: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      totalSeconds: elapsed,  // 总秒数，供统计页计算平均用时
      hintUsed: `${(this.data.t2Used ? 1 : 0) + (this.data.t3Used ? 1 : 0) + (this.data.qa ? 1 : 0)}/3`,
      hintCount: (this.data.t2Used ? 1 : 0) + (this.data.t3Used ? 1 : 0) + (this.data.qa ? 1 : 0),
      // 提示详情（供统计页弹窗展示）
      hints: this.data.hints.map(h => ({ type: h.type, text: h.text })),
      // 猜测历史，供结果页绘制得分曲线（包含词和分数）
      scoreHistory: this.data.guesses.map(g => ({
        word: g.word || '',
        score: g.score || 0,
        scoreDisplay: g.scoreDisplay || '0.00',
        order: g.order
      }))
    };
  }
});
