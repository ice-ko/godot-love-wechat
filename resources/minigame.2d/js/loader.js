// 导入 Godot 引擎相关库
import "./libs/godot";

// 加载器的默认配置项
const LoaderConfig = {
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
  // 图标相关配置
  iconConfig: {
    visible: true, // 是否显示图标
    style: {
      width: 74, // 图标宽度
      height: 30, // 图标高度
      bottom: 20, // 图标底部距离
    },
  },
};

// 为微信小游戏环境提供加密随机数功能
const crypto = {
  // 生成随机值数组的方法
  getRandomValues: (view) => {
    for (let i = 0; i < view.length; i++) {
      // 生成0-255之间的随机整数
      view[i] = Math.floor(Math.random() * 256);
    }
    return view;
  },
};

// 设置全局环境变量，为 Godot 引擎提供必要的运行环境
GameGlobal.WebAssembly = WXWebAssembly; // 设置 WebAssembly 环境
GameGlobal.crypto = crypto; // 设置加密随机数功能

/**
 * 加载器类：负责处理游戏资源的加载、显示加载进度等功能
 */
class Loader {
  /**
   * 构造函数：初始化加载器
   * @param {Object} config - 自定义配置项，会与默认配置合并
   */
  constructor(config) {
    // 合并用户配置和默认配置
    this.config = {
      ...LoaderConfig,
      ...config,
    };

    // 缓存常用窗口相关的值，避免重复计算
    this.windowWidth = window.innerWidth;
    this.windowHeight = window.innerHeight;
    this.dpr = wx.getWindowInfo().pixelRatio; // 设备像素比

    // 初始化状态
    this.currentText = this.config.textConfig.firstStartText; // 当前显示的文本
    this.progress = 0; // 当前加载进度(0-1)

    // 初始化canvas相关内容
    this.initCanvas();

    // 加载图片资源
    this.initImages();

    // 初始化WebGL环境
    const [screenTexture, cleanWebgl] = this.initWebgl();
    this.screenTexture = screenTexture;
    this.cleanWebgl = cleanWebgl;

    // 预计算固定位置，优化性能
    const {
      barConfig,
      iconConfig
    } = this.config;
    // 计算进度条的水平位置（居中）
    this.barX = (this.windowWidth - barConfig.style.width) / 2;
    // 计算进度条的垂直位置（考虑图标位置）
    this.barY = this.windowHeight - iconConfig.style.bottom - iconConfig.style.height - 30 - barConfig.style.height;
  }
  /**
   * 初始化画布
   * 创建并设置主画布和加载画布的基本属性
   */
  initCanvas() {
    // 获取WebGL上下文
    this.screenContext = canvas.getContext("webgl2");
    // 创建用于绘制加载界面的离屏canvas
    this.loadingCanvas = document.createElement("canvas");
    this.loadingContext = this.loadingCanvas.getContext("2d");

    // 设置画布尺寸，考虑设备像素比(dpr)以支持高清屏
    this.loadingCanvas.width = this.windowWidth * this.dpr;
    this.loadingCanvas.height = this.windowHeight * this.dpr;
    canvas.width = this.windowWidth * this.dpr;
    canvas.height = this.windowHeight * this.dpr;
    // 设置画布缩放，确保在高清屏上显示正常
    this.loadingContext.scale(this.dpr, this.dpr);
  }

  /**
   * 初始化图像资源
   * 创建并开始加载背景图和logo图
   */
  initImages() {
    // 创建并设置背景图
    this.backgroundImage = wx.createImage();
    this.backgroundImage.src = this.config.background;

    // 创建并设置logo图
    this.logoImage = wx.createImage();
    this.logoImage.src = this.config.logo;
    this.logoImage.width = this.config.iconConfig.style.width;
    this.logoImage.height = this.config.iconConfig.style.height;
  }

  /**
   * 加载子包
   * @returns {Promise} 加载完成的Promise
   */
  loadSubpackages() {
    return new Promise((resolve, reject) => {
      // 加载引擎子包
      const task = wx.loadSubpackage({
        name: "engine",
        success: () => {
          // 加载完成后更新进度和文本
          this.updateProgress(1, this.config.textConfig.initText);
          resolve();
        },
        fail: reject
      });

      // 监听加载进度
      if (task && task.onProgressUpdate) {
        task.onProgressUpdate(({
          progress
        }) => {
          // 更新加载进度和文本
          this.updateProgress(
            progress / 100, // 将百分比转换为0-1的值
            this.config.textConfig.downloadingText[0]
          );
        });
      }
    });
  }

  /**
   * 绘制加载进度条
   * 包括背景、进度条和文本的绘制
   */
  drawLoadingBar() {
    const ctx = this.loadingContext;
    const {
      style: barStyle
    } = this.config.barConfig;

    // 保存当前画布状态
    ctx.save();

    // 绘制进度条背景
    ctx.fillStyle = barStyle.backgroundColor;
    this.drawRoundedRect(
      ctx,
      this.barX,
      this.barY,
      barStyle.width,
      barStyle.height,
      barStyle.borderRadius
    );

    // 绘制进度条（根据当前进度）
    if (this.progress > 0) {
      ctx.fillStyle = barStyle.foregroundColor;
      const progressWidth = Math.max(0, (barStyle.width - 2 * barStyle.padding) * this.progress);
      this.drawRoundedRect(
        ctx,
        this.barX + barStyle.padding,
        this.barY + barStyle.padding,
        progressWidth,
        barStyle.height - 2 * barStyle.padding,
        barStyle.borderRadius - barStyle.padding
      );
    }

    // 绘制加载文本
    const {style: textStyle} = this.config.textConfig;
    ctx.font = `${textStyle.fontSize}px Arial`;
    ctx.fillStyle = textStyle.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.currentText,
      this.windowWidth / 2,
      this.barY + barStyle.height / 2
    );

    // 恢复画布状态
    ctx.restore();
  }

  /**
   * 绘制圆角矩形
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - 左上角x坐标
   * @param {number} y - 左上角y坐标
   * @param {number} width - 矩形宽度
   * @param {number} height - 矩形高度
   * @param {number} radius - 圆角半径
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
    // 确保圆角半径不超过矩形的一半
    radius = Math.min(radius, width / 2, height / 2);

    // 绘制圆角矩形路径
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 绘制背景图
   * 自适应屏幕大小，保持图片比例
   */
  drawBackground() {
    const ctx = this.loadingContext;
    // 计算图片宽高比
    const imageRatio = this.backgroundImage.width / this.backgroundImage.height;
    
    // 计算绘制尺寸，确保图片充满屏幕
    let drawWidth = this.windowWidth;
    let drawHeight = drawWidth / imageRatio;
    
    // 如果高度不足以覆盖屏幕，则按高度计算
    if (drawHeight < this.windowHeight) {
      drawHeight = this.windowHeight;
      drawWidth = drawHeight * imageRatio;
    }
    
    // 计算居中位置
    const x = (this.windowWidth - drawWidth) / 2;
    const y = (this.windowHeight - drawHeight) / 2;
    
    // 绘制背景图
    ctx.drawImage(
      this.backgroundImage,
      x,
      y,
      drawWidth,
      drawHeight
    );
  }

  /**
   * 绘制图标
   * 根据配置决定是否显示以及位置
   */
  drawIcon() {
    // 检查是否需要显示图标
    if (!this.config.iconConfig.visible) return;
    
    const { style: iconStyle } = this.config.iconConfig;
    // 计算图标的居中位置
    const iconX = (this.windowWidth - iconStyle.width) / 2;
    const iconY = this.windowHeight - iconStyle.bottom - iconStyle.height;
    
    // 绘制图标
    this.loadingContext.drawImage(
      this.logoImage,
      iconX,
      iconY,
      iconStyle.width,
      iconStyle.height
    );
  }

  /**
   * 更新加载进度和显示
   * @param {number} progress - 加载进度(0-1)
   * @param {string} text - 显示文本
   */
  updateProgress(progress, text) {
    this.progress = progress;
    if (text) {
      this.currentText = text;
    }
    
    // 批量渲染所有元素
    this.loadingContext.save();
    this.drawBackground();
    this.drawLoadingBar();
    this.drawIcon();
    this.loadingContext.restore();
    
    // 将渲染结果显示到屏幕
    this.drawScreen();
  }

  /**
   * 初始化WebGL环境
   * @returns {[WebGLTexture, Function]} 返回创建的纹理和清理函数
   */
  initWebgl() {
    const gl = this.screenContext;
    
    // 创建并初始化着色器程序
    const program = this.createShaderProgram(gl);
    
    // 创建并设置缓冲区
    const bufferInfo = this.createBuffers(gl, program);
    
    // 创建纹理
    const texture = this.createTexture(gl);
    
    // 设置视口大小
    gl.viewport(0, 0, this.loadingCanvas.width, this.loadingCanvas.height);
    
    // 创建清理函数
    const clean = () => this.cleanupWebGL(gl, program, bufferInfo, texture);
    
    return [texture, clean];
  }

  /**
   * 创建着色器程序
   * @param {WebGLRenderingContext} gl - WebGL上下文
   * @returns {WebGLProgram} 创建的着色器程序
   */
  createShaderProgram(gl) {
    // 顶点着色器源码
    const vertexShaderSource = `
      attribute vec4 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
      }
    `;

    // 片段着色器源码
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;

    // 创建并编译着色器
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // 创建程序并链接着色器
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // 检查程序链接是否成功
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program linking failed: ' + gl.getProgramInfoLog(program));
    }
    
    // 使用该程序
    gl.useProgram(program);
    return program;
  }
  

 /**
   * 创建着色器
   * @param {WebGLRenderingContext} gl - WebGL上下文
   * @param {number} type - 着色器类型(VERTEX_SHADER或FRAGMENT_SHADER)
   * @param {string} source - 着色器源代码
   * @returns {WebGLShader} 创建的着色器
   */
  createShader(gl, type, source) {
    // 创建着色器对象
    const shader = gl.createShader(type);
    // 设置着色器源码
    gl.shaderSource(shader, source);
    // 编译着色器
    gl.compileShader(shader);
    
    // 检查编译状态
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compilation failed: ' + error);
    }
    
    return shader;
  }

  /**
   * 创建顶点缓冲区
   * @param {WebGLRenderingContext} gl - WebGL上下文
   * @param {WebGLProgram} program - 着色器程序
   * @returns {Object} 包含缓冲区和属性位置的对象
   */
  createBuffers(gl, program) {
    // 定义顶点数据（包含位置和纹理坐标）
    const vertices = new Float32Array([
      -1.0, 1.0, 0.0, 0.0,    // 左上
      -1.0, -1.0, 0.0, 1.0,   // 左下
      1.0, -1.0, 1.0, 1.0,    // 右下
      -1.0, 1.0, 0.0, 0.0,    // 左上
      1.0, -1.0, 1.0, 1.0,    // 右下
      1.0, 1.0, 1.0, 0.0,     // 右上
    ]);
    
    // 创建缓冲区
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // 获取属性位置
    const positionLoc = gl.getAttribLocation(program, 'a_position');
    const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');
    
    // 设置顶点属性指针
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);  // 位置属性
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);  // 纹理坐标属性
    
    // 启用顶点属性数组
    gl.enableVertexAttribArray(positionLoc);
    gl.enableVertexAttribArray(texCoordLoc);
    
    return { buffer, positionLoc, texCoordLoc };
  }

  /**
   * 创建纹理
   * @param {WebGLRenderingContext} gl - WebGL上下文
   * @returns {WebGLTexture} 创建的纹理对象
   */
  createTexture(gl) {
    // 创建纹理对象
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // 设置纹理参数
    // 设置纹理环绕方式
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 设置纹理过滤方式
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    return texture;
  }

  /**
   * 清理WebGL资源
   * @param {WebGLRenderingContext} gl - WebGL上下文
   * @param {WebGLProgram} program - 着色器程序
   * @param {Object} bufferInfo - 缓冲区信息
   * @param {WebGLTexture} texture - 纹理对象
   */
  cleanupWebGL(gl, program, bufferInfo, texture) {
    // 禁用所有顶点属性数组
    const maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    for (let i = 0; i < maxAttributes; i++) {
      gl.disableVertexAttribArray(i);
    }
    
    // 删除纹理
    gl.deleteTexture(texture);
    // 删除缓冲区
    gl.deleteBuffer(bufferInfo.buffer);
    // 删除着色器程序
    gl.deleteProgram(program);
    
    // 解绑所有绑定的对象
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    
    // 重置视口并清空画布
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }

  /**
   * 将加载画布的内容绘制到屏幕
   */
  drawScreen() {
    const gl = this.screenContext;
    // 绑定纹理并更新纹理图像
    gl.bindTexture(gl.TEXTURE_2D, this.screenTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.loadingCanvas);
    // 清空画布并绘制
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /**
   * 清理所有资源
   * 在加载完成后调用，释放内存
   */
  clean() {
    // 清理图像资源
    this.logoImage.src = '';
    this.backgroundImage.src = '';
    this.logoImage = null;
    this.backgroundImage = null;
    
    // 清理canvas资源
    if (this.loadingContext) {
      // 清空加载画布
      this.loadingContext.clearRect(
        0, 
        0, 
        this.loadingCanvas.width, 
        this.loadingCanvas.height
      );
    }
    this.loadingCanvas = null;
    this.loadingContext = null;
    
    // 清理WebGL资源
    if (this.cleanWebgl) {
      this.cleanWebgl();
      this.cleanWebgl = null;
    }
    
    // 清空引用
    this.screenContext = null;
    this.screenTexture = null;
  }

  /**
   * 主加载方法
   * 处理整个加载流程
   * @returns {Promise} 加载完成的Promise
   */
  load() {
    /**
     * 加载图片资源
     * @returns {Promise} 所有图片加载完成的Promise
     */
    const loadResources = () => {
      return Promise.all([
        // 加载背景图
        new Promise((resolve, reject) => {
          this.backgroundImage.onload = resolve;
          this.backgroundImage.onerror = reject;
        }),
        // 加载logo图
        new Promise((resolve, reject) => {
          this.logoImage.onload = resolve;
          this.logoImage.onerror = reject;
        })
      ]);
    };

    /**
     * 错误处理函数
     * @param {Error} error - 错误对象
     * @returns {Promise} 被拒绝的Promise
     */
    const handleError = (error) => {
      console.error('Loader error:', error);
      return Promise.reject(error);
    };

    // 执行加载流程
    return loadResources()
      .then(() => {
        // 图片加载完成，更新进度
        this.progress += 1;
        // 加载子包
        return this.loadSubpackages();
      })
      .then(() => {
        // 创建引擎实例
        const engine = new Engine();
        // 启动游戏
        return engine.startGame({
          canvas,                          // 游戏画布
          executable: "engine/godot",      // 引擎可执行文件路径
          mainPack: "engine/godot.zip",   // 主包路径
          args: ["--audio-driver", "ScriptProcessor"]  // 启动参数
        });
      })
      .then(() => {
        // 加载完成，清理资源
        this.clean();
      })
      .catch(handleError);  // 统一错误处理
  }
}

// 导出Loader类
export default Loader;