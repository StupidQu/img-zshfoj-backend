document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("fileInput");
  const selectedFile = document.getElementById("selectedFile");
  const uploadBtn = document.getElementById("uploadBtn");
  const previewContainer = document.getElementById("previewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const imageUrl = document.getElementById("imageUrl");
  const shortUrl = document.getElementById("shortUrl");
  const imagePath = document.getElementById("imagePath");
  const copyUrlBtn = document.getElementById("copyUrlBtn");
  const copyShortUrlBtn = document.getElementById("copyShortUrlBtn");
  const alertPopup = document.getElementById("alertPopup");
  const loading = document.getElementById("loading");
  const imageMarkdown = document.getElementById("imageMarkdown");
  const shortMarkdown = document.getElementById("shortMarkdown");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const copyShortMarkdownBtn = document.getElementById("copyShortMarkdownBtn");

  // 文件选择处理
  fileInput.addEventListener("change", function () {
    // 如果选择了新文件，先隐藏之前的预览结果
    previewContainer.classList.add("hidden");

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];

      // 检查文件类型
      if (!file.type.match("image.*")) {
        showAlert("请选择图片文件", "error");
        fileInput.value = "";
        selectedFile.classList.add("hidden");
        uploadBtn.disabled = true;
        return;
      }

      // 检查文件大小 (限制为5MB)
      if (file.size > 5 * 1024 * 1024) {
        showAlert("文件大小不能超过5MB", "error");
        fileInput.value = "";
        selectedFile.classList.add("hidden");
        uploadBtn.disabled = true;
        return;
      }

      selectedFile.textContent = `已选择: ${file.name} (${formatFileSize(
        file.size
      )})`;
      selectedFile.classList.remove("hidden");
      uploadBtn.disabled = false;

      // 预览选择的图片 - 不直接在上传前显示到主预览区域
      const reader = new FileReader();
      reader.onload = function (e) {
        // 不设置imagePreview.src，仅在上传成功后显示
      };
      reader.readAsDataURL(file);
    } else {
      selectedFile.classList.add("hidden");
      uploadBtn.disabled = true;
    }
  });

  // 上传按钮点击事件
  uploadBtn.addEventListener("click", uploadImage);

  // 复制链接按钮点击事件
  copyUrlBtn.addEventListener("click", function () {
    copyToClipboard(imageUrl.textContent);
  });
  
  // 复制短链接按钮点击事件
  copyShortUrlBtn?.addEventListener("click", function () {
    copyToClipboard(shortUrl.textContent);
  });
  
  // 复制Markdown按钮点击事件
  copyMarkdownBtn?.addEventListener("click", function () {
    copyToClipboard(imageMarkdown.textContent);
  });
  
  // 复制短链Markdown按钮点击事件
  copyShortMarkdownBtn?.addEventListener("click", function () {
    copyToClipboard(shortMarkdown.textContent);
  });

  // 为历史上传的图片添加点击复制功能
  setupHistoricalImageClickToCopy();
  
  // 添加粘贴上传功能
  document.addEventListener("paste", handlePaste);
  
  // 处理粘贴事件
  function handlePaste(e) {
    // 防止默认行为
    e.preventDefault();
    e.stopPropagation();
    
    // 获取剪贴板数据
    const clipboardData = e.clipboardData || window.clipboardData;
    const items = clipboardData.items;
    
    let imageFile = null;
    
    // 遍历剪贴板项目，查找图片
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imageFile = items[i].getAsFile();
          break;
        }
      }
    }
    
    // 如果找到图片，处理上传
    if (imageFile) {
      // 显示正在处理的提示
      showAlert("检测到图片，正在上传...", "success");
      
      // 创建一个新的 FileList 对象（通过 DataTransfer）
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(imageFile);
      
      // 设置文件输入的文件
      fileInput.files = dataTransfer.files;
      
      // 显示选择的文件信息
      selectedFile.textContent = `已选择: 粘贴的图片 (${formatFileSize(imageFile.size)})`;
      selectedFile.classList.remove("hidden");
      
      // 启用上传按钮
      uploadBtn.disabled = false;
      
      // 自动上传
      uploadImage();
    }
  }

  // 上传图片函数
  function uploadImage() {
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("image", file);

    // 显示加载状态
    loading.classList.remove("hidden");
    uploadBtn.disabled = true;

    fetch("/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        loading.classList.add("hidden");

        if (data.success) {
          // 上传成功后才显示预览和信息
          // 设置图片预览
          const tempImage = new Image();
          tempImage.onload = function () {
            imagePreview.src = this.src;
            // 显示上传成功结果区域
            previewContainer.classList.remove("hidden");
          };
          tempImage.src = data.imageUrl;

          // 设置信息
          imageUrl.textContent = data.imageUrl;
          shortUrl.textContent = data.shortUrl || "";
          
          // 隐藏存储路径
          if (imagePath) {
            imagePath.parentElement.classList.add("hidden");
          }
          
          // 设置Markdown格式链接
          if (imageMarkdown) {
            const filename = data.key.split('/').pop();
            imageMarkdown.textContent = `![${filename}](${data.imageUrl})`;
          }
          
          // 设置短链接Markdown格式
          if (shortMarkdown && data.shortUrl) {
            const filename = data.key.split('/').pop();
            shortMarkdown.textContent = `![image](${data.shortUrl})`;
          }
          
          showAlert("图片上传成功", "success");

          // 添加新上传的图片到历史记录而不刷新页面
          addImageToHistory(data.imageUrl, data.key, data.shortUrl);
          
          // 重置文件输入框以便下次上传
          fileInput.value = "";
          selectedFile.classList.add("hidden");
          uploadBtn.disabled = true;
        } else {
          // 显示错误信息
          showAlert(data.message || "上传失败", "error");
          uploadBtn.disabled = false;
        }
      })
      .catch((error) => {
        loading.classList.add("hidden");
        uploadBtn.disabled = false;
        showAlert("上传出错: " + error.message, "error");
        console.error("上传错误:", error);
      });
  }

  // 添加新上传的图片到历史记录区域
  function addImageToHistory(imageUrl, key, shortUrl) {
    const historyContainer = document.querySelector('.grid');
    
    // 如果有"暂无上传记录"提示，则移除它
    const emptyState = document.querySelector('.bg-gray-50.text-gray-500.text-center.py-8.rounded');
    if (emptyState) {
      emptyState.remove();
      
      // 创建网格容器
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 md:grid-cols-3 gap-4';
      document.querySelector('.mt-12').appendChild(grid);
    }
    
    // 创建新图片项
    const newImageItem = document.createElement('div');
    newImageItem.className = 'bg-white border rounded overflow-hidden shadow-sm hover:shadow-md transition duration-200 transform hover:-translate-y-1 image-item';
    // 存储URL作为数据属性
    newImageItem.dataset.url = imageUrl;
    newImageItem.dataset.shortUrl = shortUrl || '';
    
    const date = new Date().toLocaleString();
    const filename = key.split('/').pop();
    
    newImageItem.innerHTML = `
      <img src="${imageUrl}" alt="上传图片" class="w-full h-36 object-cover">
      <div class="p-2">
        <div class="text-xs text-gray-600 truncate">${key}</div>
        <div class="text-xs text-gray-500 mt-1">${date}</div>
        <div class="flex mt-2 space-x-1">
          <button class="copy-url-btn bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制链接</button>
          <button class="copy-short-url-btn bg-purple-500 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制短链</button>
        </div>
        <div class="flex mt-1 space-x-1">
          <button class="copy-md-btn bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制MD</button>
          <button class="copy-short-md-btn bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制短MD</button>
        </div>
      </div>
    `;
    
    // 将新图片添加到历史记录的最前面
    const historyGrid = document.querySelector('.grid');
    if (historyGrid) {
      historyGrid.insertBefore(newImageItem, historyGrid.firstChild);
      
      // 添加按钮点击事件
      setupItemButtons(newImageItem, imageUrl, shortUrl, filename);
    }
  }

  // 为图片项设置按钮点击事件
  function setupItemButtons(item, url, shortUrl, filename) {
    const copyUrlBtn = item.querySelector('.copy-url-btn');
    const copyShortUrlBtn = item.querySelector('.copy-short-url-btn');
    const copyMdBtn = item.querySelector('.copy-md-btn');
    const copyShortMdBtn = item.querySelector('.copy-short-md-btn');
    
    // 如果没有传入filename，尝试从key中获取
    if (!filename) {
      const keyElement = item.querySelector('.text-gray-600.truncate');
      if (keyElement) {
        const key = keyElement.textContent;
        filename = key.split('/').pop();
      } else {
        filename = 'image';
      }
    }
    
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(url);
      });
    }
    
    if (copyShortUrlBtn && shortUrl) {
      copyShortUrlBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(shortUrl);
      });
    }
    
    if (copyMdBtn) {
      copyMdBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(`![${filename}](${url})`);
      });
    }
    
    if (copyShortMdBtn && shortUrl) {
      copyShortMdBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(`![${filename}](${shortUrl})`);
      });
    }
  }

  // 为现有的历史图片添加点击复制功能
  function setupHistoricalImageClickToCopy() {
    const historyItems = document.querySelectorAll('.grid > div');
    historyItems.forEach(item => {
      // 获取URL和短链接
      const url = item.dataset.url;
      const shortUrl = item.dataset.shortUrl;
      
      // 获取文件名
      const keyElement = item.querySelector('.text-gray-600.truncate');
      let filename = 'image';
      if (keyElement) {
        const key = keyElement.textContent;
        filename = key.split('/').pop();
      }
      
      // 确保没有cursor-pointer类
      item.classList.remove('cursor-pointer');
      
      // 移除title属性
      item.removeAttribute('title');
      
      // 如果按钮容器不完整，重新创建
      if (!item.querySelector('.copy-short-url-btn')) {
        const infoContainer = item.querySelector('.p-2');
        if (infoContainer) {
          // 清除旧的按钮（如果有）
          const oldButtons = infoContainer.querySelectorAll('.flex');
          oldButtons.forEach(btn => btn.remove());
          
          // 创建新的按钮组
          const buttonRow1 = document.createElement('div');
          buttonRow1.className = 'flex mt-2 space-x-1';
          buttonRow1.innerHTML = `
            <button class="copy-url-btn bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制链接</button>
            <button class="copy-short-url-btn bg-purple-500 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制短链</button>
          `;
          
          const buttonRow2 = document.createElement('div');
          buttonRow2.className = 'flex mt-1 space-x-1';
          buttonRow2.innerHTML = `
            <button class="copy-md-btn bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制MD</button>
            <button class="copy-short-md-btn bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制短MD</button>
          `;
          
          infoContainer.appendChild(buttonRow1);
          infoContainer.appendChild(buttonRow2);
        }
      }
      
      // 设置按钮事件
      setupItemButtons(item, url, shortUrl, filename);
    });
  }

  // 复制文本到剪贴板
  function copyToClipboard(text) {
    if (!text) {
      showAlert("没有可复制的内容", "error");
      return;
    }
    
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showAlert("已复制到剪贴板", "success");
  }

  // 显示提示信息
  function showAlert(message, type) {
    alertPopup.textContent = message;
    alertPopup.className =
      "fixed top-4 right-4 px-4 py-3 rounded text-white opacity-0 transition-opacity duration-300";

    if (type === "success") {
      alertPopup.classList.add("bg-green-500");
    } else {
      alertPopup.classList.add("bg-red-500");
    }

    // 显示消息
    setTimeout(() => {
      alertPopup.classList.replace("opacity-0", "opacity-100");
    }, 10);

    // 3秒后隐藏
    setTimeout(() => {
      alertPopup.classList.replace("opacity-100", "opacity-0");
    }, 3000);
  }

  // 格式化文件大小
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  // 支持拖放上传
  const fileLabel = document.querySelector('label[for="fileInput"]');

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    fileLabel.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    fileLabel.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    fileLabel.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    fileLabel.classList.add("border-blue-500", "bg-blue-50");
  }

  function unhighlight() {
    fileLabel.classList.remove("border-blue-500", "bg-blue-50");
  }

  fileLabel.addEventListener("drop", handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      fileInput.files = files;
      const event = new Event("change");
      fileInput.dispatchEvent(event);
    }
  }
});