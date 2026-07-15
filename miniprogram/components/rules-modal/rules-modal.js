// components/rules-modal/rules-modal.js
// 规则说明弹窗组件

Component({
  // apply-shared：让 app.wxss 的全局样式应用到组件内部
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    rules: {
      type: Array,
      value: [
        '输入任意词，AI 判断相似度 0-100%',
        '相似度越高越接近答案，100% = 猜中！',
        '点击提示让 AI 帮助你'
      ]
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    }
  }
});