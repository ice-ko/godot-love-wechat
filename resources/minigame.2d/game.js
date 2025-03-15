import "./weapp-adapter";
import Loader from "./js/loader";

function checkUpdate() {
  const updateManager = wx.getUpdateManager();
  updateManager.onCheckForUpdate(() => {
    // 请求完新版本信息的回调
    // console.log(res.hasUpdate)
  });
  updateManager.onUpdateReady(() => {
    wx.showModal({
      title: '更新提示',
      content: '新版本已经准备好，是否重启应用？',
      success(res) {
        if (res.confirm) {
          // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
          updateManager.applyUpdate();
        }
      },
    });
  });
  updateManager.onUpdateFailed(() => {
    // 新版本下载失败
  });
}
checkUpdate();


const config = {
  // logo图片路径
  logo: "images/logo.png",
  // 背景图片路径
  background: "images/background.png",
  // 文本相关配置
  textConfig: {
    firstStartText: '首次加载请耐心等待', // 首次加载显示文本
    downloadingText: [ // 下载过程中的文本数组
      '正在加载资源',
      '加载中...',
      '请稍候...'
    ],
    compilingText: '编译中', // 编译阶段文本
    initText: '初始化中', // 初始化阶段文本
    completeText: '开始游戏', // 完成时的文本
    textDuration: 1500, // 文本切换动画持续时间
    style: {
      color: '#ffffff', // 文本颜色
      fontSize: 14, // 文本大小
    },
  },
  // 进度条相关配置
  barConfig: {
    style: {
      width: 240, // 进度条宽度
      height: 25, // 进度条高度
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // 进度条背景色
      foregroundColor: '#4CAF50', // 进度条前景色
      borderRadius: 20, // 进度条圆角半径
      padding: 2, // 进度条内边距
    },
  },
  // logo图标相关配置
  iconConfig: {
    visible: true, // 是否显示图标
    style: {
      width: 74, // 图标宽度
      height: 30, // 图标高度
      bottom: 30, // 图标底部距离
    },
  },
};
const loader = new Loader(config);
loader.load();