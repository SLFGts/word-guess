// components/quit-modal/quit-modal.js
// 放弃确认弹窗组件

Component({
  // apply-shared：让 app.wxss 全局样式（.modal-bg/.modal-card/.doodle-button 等）应用到组件
  options: {
    styleIsolation: 'apply-shared'
  },
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
    onContinue() {
      this.triggerEvent('continue');
    },
    onQuit() {
      this.triggerEvent('quit');
    }
  }
});
