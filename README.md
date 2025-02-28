# Get Started

Clone this repo, run `npm install`, configure `config.js`, run it!

```js
// config.js
export default {
  // 七牛云配置信息
  qiniu: {
    accessKey: "",
    secretKey: "",
    bucket: "",
    // 如果绑定了自定义域名，可以在这里配置
    domain: "",
  },
  // 应用配置
  app: {
    port: process.env.PORT || 3000,
    sessionSecret: "",
  },
};
```

# License

MIT.
