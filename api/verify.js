// api/verify.js
export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '不允许' });
    }

    const { code } = req.body;
    if (!code) {
        return res.status(401).json({ success: false, message: '请输入测试码' });
    }

    // 格式长这样：CCK-XXXXYYYY (前缀 + 8位大写字母和数字)
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode.startsWith('CCK-') || cleanCode.length !== 12) {
        return res.status(401).json({ success: false, message: '无效的测试码，请检查是否输入正确' });
    }

    // 把 "CCK-" 砍掉，留下后面的 8 位字符
    const body = cleanCode.replace('CCK-', ''); 
    
    // 我们把这 8 位拆开：
    // 前 4 位是隐藏的“时间戳”
    // 中间 3 位是“随机干扰码”
    // 最后 1 位是“防伪校验码”
    const timeStr = body.substring(0, 4);
    const randStr = body.substring(4, 7);
    const checksum = body.substring(7, 8);

    // 【1】核对防伪校验码（验证密码是不是伪造的）
    const baseStr = timeStr + randStr;
    let sum = 0;
    for(let i = 0; i < 7; i++) {
        // 根据每个字符的位置进行复杂的乘法计算
        sum += baseStr.charCodeAt(i) * (i + 1);
    }
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const expectedChecksum = chars[sum % 36]; // 得出真正的防伪码

    if (checksum !== expectedChecksum) {
        return res.status(401).json({ success: false, message: '无效的测试码，请勿尝试瞎蒙哦' });
    }

    // 【2】解密隐藏的时间，判断是否超过 30 天
    const codeHours = parseInt(timeStr, 36); // 把密码里的时间字母变回数字（小时）
    const currentHours = Math.floor(Date.now() / (1000 * 60 * 60)); // 获取服务器现在的时间（小时）
    
    const hoursDiff = currentHours - codeHours; // 算算过去了多少小时

    // 如果时间相差超过 720 小时（30天 * 24小时 = 720小时）
    if (hoursDiff > 720) {
        return res.status(401).json({ success: false, message: '⚠️ 该测试码已过期（超过30天有效期自动销毁）' });
    }
    
    // 如果是未来的时间（防止穿越），也拦截
    if (hoursDiff < 0) {
        return res.status(401).json({ success: false, message: '测试码时空异常' });
    }

    // 历经九九八十一难，终于放行！
    res.status(200).json({ success: true, message: '验证成功' });
}
