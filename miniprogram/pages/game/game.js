// pages/game/game.js
// 游戏页：核心猜词界面，沉浸式心流体验
// 设计原则：所有 UI 服务于"降低思考成本，让玩家专注于猜"

const api = require('../../utils/api');
const store = require('../../utils/game-store');

Page({
  data: {
    // 游戏状态
    gameId: '',
    mode: 'normal',           // normal / daily / theme
    similarityMode: 'vector', // vector 或 embedding（从 newGame 返回）
    guessCount: 0,            // 当前猜测次数
    wordLen: 0,               // 目标词字数
    startTime: 0,             // 游戏开始时间戳

    // 输入
    word: '',

    // 分数/相似度（根据模式使用不同字段）
    score: 0,                 // Mode A: 百分比分数
    similarity: 0,            // Mode B: 原始余弦相似度
    scoreHint: '输入一个词开始猜~',
    scoreColor: '#A3C4F3',    // 分数颜色（蓝/橙/绿）
    barWidth: 0,              // 信号条宽度
    barColor: '#A3C4F3',      // 信号条颜色

    // 猜测历史
    guesses: [],

    // 提示状态
    t1: '',                   // T1 描述
    t2: '',                   // T2 锚点
    qa: '',                   // T3 提问裁判回答
    t1Used: false,            // T1 是否已使用
    t2Used: false,            // T2 是否已使用
    t3Used: false,            // T3 是否已使用
    hintText: '',             // 当前显示的提示文字

    // 弹窗
    quitOpen: false,          // 放弃确认弹窗

    // 调试
    debugTarget: '',          // 显示的答案（调试用）

    // 加载状态
    loading: false,
    loadingText: '加载中...'
  },

  onLoad(options) {
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

      // 云函数返回 { gameId, len, similarityMode }
      const gameId = res.gameId;
      const wordLen = res.len;
      const similarityMode = res.similarityMode || 'vector';

      store.reset(gameId, wordLen);

      this.setData({
        gameId,
        wordLen,
        similarityMode,
        guessCount: 0,
        guesses: [],
        score: 0,
        similarity: 0,
        scoreHint: '输入一个词开始猜~',
        scoreColor: '#A3C4F3',
        barWidth: 0,
        barColor: '#A3C4F3',
        t1: '', t2: '', qa: '',
        t1Used: false, t2Used: false, t3Used: false,
        hintText: '',
        debugTarget: '',
        loading: false
      });
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

    // 检查是否已猜过
    if (this.data.guesses.find(g => g.word === word)) {
      wx.showToast({ title: '已经猜过这个词了', icon: 'none' });
      this.setData({ word: '' });
      return;
    }

    this.setData({ loading: true });

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

        const newGuess = {
          word,
          similarity,
          score: similarity,  // 兼容历史显示
          barWidth: similarity * 100,  // 进度条宽度
          color,
          order: store.store.orderCounter,
          isBest: similarity >= store.store.maxScore
        };
        const guesses = [...this.data.guesses, newGuess];

        const maxSim = Math.max(...guesses.map(g => g.similarity));
        guesses.forEach(g => g.isBest = g.similarity === maxSim);

        const update = {
          word: '',
          similarity,
          score: similarity,  // 兼容
          scoreHint: hint,
          scoreColor: color,
          barWidth: similarity * 100,
          barColor: color,
          guesses,
          guessCount: guesses.length,
          loading: false
        };

        if (won || similarity >= 0.99) {
          this.setData(update);
          this._saveGameResult(word);
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

        const score = res.score;
        const won = res.won;

        store.addGuess(word, score);

        const color = this._scoreColor(score);
        const hint = this._scoreHint(score);

        const newGuess = {
          word,
          score,
          color,
          order: store.store.orderCounter,
          isBest: score >= store.store.maxScore
        };
        const guesses = [...this.data.guesses, newGuess];

        const maxScore = Math.max(...guesses.map(g => g.score));
        guesses.forEach(g => g.isBest = g.score === maxScore);

        const update = {
          word: '',
          score,
          scoreHint: hint,
          scoreColor: color,
          barWidth: score,
          barColor: color,
          guesses,
          guessCount: guesses.length,
          loading: false
        };

        if (won || score === 100) {
          this.setData(update);
          this._saveGameResult(word);
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

  /** 获取提示 */
  async onHint(e) {
    const level = e.currentTarget.dataset.level;

    // 检查是否已使用
    if (level === '1' && this.data.t1Used) return;
    if (level === '2' && this.data.t2Used) return;
    if (level === '3' && this.data.t3Used) return;

    this.setData({ loading: true });

    try {
      const res = await api.getHint(this.data.gameId, level);

      const update = { loading: false };

      // 云函数返回结构：
      // level 1/2: { hint, used }
      // level 3: { answer, used }
      if (level === '1') {
        update.t1 = res.hint || '';
        update.t1Used = true;
        update.hintText = res.hint || '';
      } else if (level === '2') {
        update.t2 = res.hint || '';
        update.t2Used = true;
        update.hintText = res.hint || '';
      } else if (level === '3') {
        update.qa = res.answer || '';
        update.t3Used = true;
        update.hintText = res.answer || '';
      }

      this.setData(update);
    } catch (err) {
      console.error('获取提示失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '获取提示失败', icon: 'none' });
    }
  },

  /** 提问裁判 */
  onAsk() {
    // 检查是否已解锁 T1 和 T2
    if (!this.data.t1Used || !this.data.t2Used) {
      wx.showToast({ title: '请先查看提示 1 和提示 2', icon: 'none' });
      return;
    }

    // 检查是否已使用
    if (this.data.t3Used) {
      wx.showToast({ title: '提问机会已用完', icon: 'none' });
      return;
    }

    // 弹出输入框让玩家输入问题
    wx.showModal({
      title: '向裁判提问',
      placeholderText: '输入你的问题...',
      editable: true,
      success: async (res) => {
        if (res.confirm && res.content) {
          await this._submitQuestion(res.content.trim());
        }
      }
    });
  },

  /** 提交问题给裁判 */
  async _submitQuestion(question) {
    if (!question) return;

    this.setData({ loading: true });

    try {
      const res = await api.getHint(this.data.gameId, 3, question);

      this.setData({
        qa: res.answer || '',
        t3Used: true,
        hintText: res.answer || '',
        loading: false
      });
    } catch (err) {
      console.error('提问失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '提问失败', icon: 'none' });
    }
  },

  /** 调试：显示答案 */
  async onShowAnswer() {
    if (this.data.debugTarget) return;  // 已显示过

    this.setData({ loading: true });

    try {
      const res = await api.getAnswer(this.data.gameId);
      this.setData({
        debugTarget: res.target || '未知',
        loading: false
      });
      wx.showToast({ title: `答案：${res.target}`, icon: 'none', duration: 3000 });
    } catch (err) {
      console.error('获取答案失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '获取答案失败', icon: 'none' });
    }
  },

  /** 打开放弃确认弹窗 */
  onOpenQuit() {
    this.setData({ quitOpen: true });
  },

  /** 关闭放弃确认弹窗 */
  onCloseQuit() {
    this.setData({ quitOpen: false });
  },

  /** 确认放弃 */
  onConfirmQuit() {
    this.setData({ quitOpen: false });
    wx.navigateBack();
  },

  /** 返回首页 */
  onGoHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /** 根据分数返回颜色（Mode A） */
  _scoreColor(score) {
    if (score >= 75) return '#A8E6A3';  // 薄荷绿
    if (score >= 30) return '#FFB347';  // 暖橙
    return '#A3C4F3';                    // 天蓝
  },

  /** 根据分数返回引导语（Mode A） */
  _scoreHint(score) {
    if (score >= 75) return '很近了！快到了！';
    if (score >= 30) return '方向对了！再试试';
    return '还差很远，继续猜~';
  },

  /** 根据相似度返回颜色（Mode B） */
  _similarityColor(similarity) {
    if (similarity >= 0.6) return '#A8E6A3';  // 薄荷绿
    if (similarity >= 0.3) return '#FFB347';  // 暖橙
    return '#A3C4F3';                          // 天蓝
  },

  /** 根据相似度返回引导语（Mode B） */
  _similarityHint(similarity) {
    if (similarity >= 0.6) return '很近了！快到了！';
    if (similarity >= 0.3) return '方向对了！再试试';
    return '还差很远，继续猜~';
  },

  /** 保存游戏结果到本地存储 */
  _saveGameResult(targetWord) {
    const history = wx.getStorageSync('gameHistory') || [];
    const gameData = this._getGameData();

    history.unshift(gameData);
    wx.setStorageSync('gameHistory', history.slice(0, 50)); // 最多保留 50 条

    // 更新统计
    const stats = wx.getStorageSync('gameStats') || { totalGames: 0, totalGuesses: 0 };
    stats.totalGames++;
    stats.totalGuesses += gameData.guessCount;
    stats.avgGuesses = (stats.totalGuesses / stats.totalGames).toFixed(1);
    wx.setStorageSync('gameStats', stats);
  },

  /** 获取游戏数据用于结算页 */
  _getGameData() {
    const elapsed = Math.floor((Date.now() - this.data.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    // 根据模式获取最高分
    let maxScore;
    if (this.data.similarityMode === 'embedding') {
      maxScore = Math.max(...this.data.guesses.map(g => g.similarity || 0), 0);
    } else {
      maxScore = Math.max(...this.data.guesses.map(g => g.score || 0), 0);
    }

    return {
      targetWord: '未知',  // TODO: 从云函数获取
      guessCount: this.data.guesses.length,
      maxScore: maxScore,
      similarityMode: this.data.similarityMode,
      totalTime: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      hintUsed: `${(this.data.t1Used ? 1 : 0) + (this.data.t2Used ? 1 : 0) + (this.data.t3Used ? 1 : 0)}/3`
    };
  }
});
