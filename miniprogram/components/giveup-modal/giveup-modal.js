// components/giveup-modal/giveup-modal.js
// 放弃结算弹窗组件（放弃游戏后显示结果）

Component({
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

  methods: {
    onPlayAgain() {
      this.triggerEvent('playAgain');
    },
    onGoHome() {
      this.triggerEvent('goHome');
    }
  }
});
