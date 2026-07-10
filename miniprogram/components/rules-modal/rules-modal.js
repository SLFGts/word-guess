// components/rules-modal/rules-modal.js
// 规则说明弹窗组件

Component({
  properties: {
    rules: {
      type: Array,
      value: [
        { icon: '️', text: '输入任意中文词，系统返回相关度 0-100 分' },
        { icon: '💡', text: '分数越高越接近答案，100 分 = 猜中！' },
        { icon: '🎯', text: '可以用提示辅助，但每局每级只能用一次' }
      ]
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    }
  }
});
