# DeepJelly 角色管理配置文件

此文件用于存储 DeepJelly API 的连接信息和认证凭据。

## API 配置

### 服务器地址
```
127.0.0.1
```

### 端口
```
12260
```

### 认证令牌 (Bearer Token)
```
your_deepjelly_token_here
```

## 配置说明

- **服务器地址**: DeepJelly HTTP API 的主机地址，默认为 `127.0.0.1`
- **端口**: DeepJelly HTTP API 的监听端口，默认为 `12261`
- **认证令牌**: 从 DeepJelly 应用的应用集成（AppIntegration）中获取的 `deepjellyToken`

**注意**: 以上三个参数（地址、端口、token）各自只有一个值。如果接收到新的参数值，请直接更新原值。

## 获取 Token 的步骤

1. 打开 DeepJelly 应用
2. 进入应用集成管理
3. 创建或编辑一个应用集成
4. 复制生成的 `deepjellyToken`
5. 将 token 粘贴到上方"认证令牌"部分
