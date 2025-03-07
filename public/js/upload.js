document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("fileInput");
  const selectedFile = document.getElementById("selectedFile");
  const uploadBtn = document.getElementById("uploadBtn");
  const previewContainer = document.getElementById("previewContainer");
  const imagePreview = document.getElementById("imagePreview");
  const imageUrl = document.getElementById("imageUrl");
  const imagePath = document.getElementById("imagePath");
  const copyUrlBtn = document.getElementById("copyUrlBtn");
  const alertPopup = document.getElementById("alertPopup");
  const loading = document.getElementById("loading");
  const imageMarkdown = document.getElementById("imageMarkdown");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");

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
  
  // 复制Markdown按钮点击事件
  copyMarkdownBtn?.addEventListener("click", function () {
    copyToClipboard(imageMarkdown.textContent);
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
          // 隐藏存储路径
          if (imagePath) {
            imagePath.parentElement.classList.add("hidden");
          }
          
          // 设置Markdown格式链接
          if (imageMarkdown) {
            const filename = data.key.split('/').pop();
            imageMarkdown.textContent = `![${filename}](${data.imageUrl})`;
          }
          
          showAlert("图片上传成功", "success");

          // 添加新上传的图片到历史记录而不刷新页面
          addImageToHistory(data.imageUrl, data.key);
          
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
  function addImageToHistory(imageUrl, key) {
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
    // 存储URL作为数据属性，但不添加点击事件
    newImageItem.dataset.url = imageUrl;
    
    const date = new Date().toLocaleString();
    const filename = key.split('/').pop();
    
    newImageItem.innerHTML = `
      <img src="${imageUrl}" alt="上传图片" class="w-full h-36 object-cover">
      <div class="p-2">
        <div class="text-xs text-gray-600 truncate">${key}</div>
        <div class="text-xs text-gray-500 mt-1">${date}</div>
        <div class="flex mt-2 space-x-1">
          <button class="copy-url-btn bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制链接</button>
          <button class="copy-md-btn bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制Markdown</button>
        </div>
      </div>
    `;
    
    // 将新图片添加到历史记录的最前面
    const historyGrid = document.querySelector('.grid');
    if (historyGrid) {
      historyGrid.insertBefore(newImageItem, historyGrid.firstChild);
      
      // 添加按钮点击事件
      const copyUrlBtn = newImageItem.querySelector('.copy-url-btn');
      const copyMdBtn = newImageItem.querySelector('.copy-md-btn');
      
      copyUrlBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(imageUrl);
      });
      
      copyMdBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        copyToClipboard(`![${filename}](${imageUrl})`);
      });
    }
  }

  // 为现有的历史图片添加点击复制功能
  function setupHistoricalImageClickToCopy() {
    const historyItems = document.querySelectorAll('.grid > div');
    historyItems.forEach(item => {
      // 从图片 src 获取 URL
      const img = item.querySelector('img');
      if (img) {
        const url = img.src;
        const key = item.querySelector('.text-gray-600.truncate')?.textContent || '';
        const filename = key.split('/').pop();
        
        // 存储图片 URL 作为数据属性，但不添加点击事件
        item.dataset.url = url;
        
        // 确保没有cursor-pointer类
        item.classList.remove('cursor-pointer');
        
        // 移除title属性
        item.removeAttribute('title');
        
        // 添加按钮容器（如果不存在）
        if (!item.querySelector('.copy-url-btn')) {
          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'flex mt-2 space-x-1';
          buttonContainer.innerHTML = `
            <button class="copy-url-btn bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制链接</button>
            <button class="copy-md-btn bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded transition duration-200 flex-1">复制Markdown</button>
          `;
          
          const infoContainer = item.querySelector('.p-2');
          if (infoContainer) {
            infoContainer.appendChild(buttonContainer);
          }
        }
        
        // 添加按钮点击事件
        const copyUrlBtn = item.querySelector('.copy-url-btn');
        const copyMdBtn = item.querySelector('.copy-md-btn');
        
        if (copyUrlBtn) {
          copyUrlBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            copyToClipboard(url);
          });
        }
        
        if (copyMdBtn) {
          copyMdBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            copyToClipboard(`![${filename}](${url})`);
          });
        }
      }
    });
  }

  // 复制文本到剪贴板
  function copyToClipboard(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showAlert("链接已复制到剪贴板", "success");
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