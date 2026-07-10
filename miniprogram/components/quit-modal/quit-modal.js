// components/quit-modal/quit-modal.js
// 放弃确认弹窗组件

Component({
  properties: {
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
    onContinue() {
      this.triggerEvent('continue');
    },
    onQuit() {
      this.triggerEvent('quit');
    }
  }
});
