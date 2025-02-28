document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const password = document.getElementById('password');
    const password2 = document.getElementById('password2');
    
    form.addEventListener('submit', function(e) {
      if (password.value !== password2.value) {
        e.preventDefault();
        
        // 显示错误信息
        const errorAlert = document.createElement('div');
        errorAlert.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6';
        errorAlert.textContent = '两次输入的密码不一致';
        
        // 寻找已有的错误提示并移除
        const existingAlert = document.querySelector('.bg-red-100');
        if (existingAlert) {
          existingAlert.remove();
        }
        
        // 插入新的错误提示
        const formHeading = document.querySelector('h1');
        form.insertBefore(errorAlert, formHeading.nextSibling);
        
        // 聚焦到确认密码字段
        password2.focus();
      }
    });
  });