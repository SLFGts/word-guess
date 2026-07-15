// components/giveup-modal/giveup-modal.js
// 放弃结算弹窗组件（放弃游戏后显示结果）

Component({
  // apply-shared：让 app.wxss 全局样式（.modal-bg/.modal-card/.doodle-button 等）应用到组件
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    targetWord: {
      type: String,
      value: '未知'
    },
    guessCount: {
      type: Number,
      value: 0
    },
    maxScore: {
      type: Number,
      value: 0
    }
  },

  observers: {
    // maxScore 变化时同步生成两位小数显示字符串
    'maxScore': function(val) {
      this.setData({ maxScoreDisplay: parseFloat(val).toFixed(2) });
    }
  },

  data: {
    maxScoreDisplay: '0.00'
  },

  lifetimes: {
    attached() {
      this.setData({ maxScoreDisplay: parseFloat(this.data.maxScore).toFixed(2) });
    }
  },

  methods: {
    onPlayAgain() {
      this.triggerEvent('playAgain');
    },
    onGoHome() {
      this.triggerEvent('goHome');
    }
  }
});
