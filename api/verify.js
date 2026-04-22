// api/verify.js
export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '不允许' });
    }

    // 防御性处理：防止由于请求包异常(无 body 等情况)导致解析代码崩溃引发 500
    if (!req.body || typeof req.body.code === 'undefined') {
        return res.status(400).json({ success: false, message: '请求参数缺失！' });
    }

    const { code } = req.body;
    
    // 错误类型 1：没填密码
    if (!code) {
        return res.status(401).json({ success: false, message: '请输入测试码！' });
    }

    // 防御性：确保即使前端传来的包含空格也能处理，并强制转大写兼容
    const cleanCode = String(code).trim().toUpperCase();
    
    // 错误类型 2：格式不对（比如少复制了一位，或者前缀不是 CCK-）
    if (!cleanCode.startsWith('CCK-') || cleanCode.length !== 12) {
        return res.status(401).json({ success: false, message: '❌ 测试码格式不正确，请检查是否多输了空格或少漏了字母。' });
    }

    const body = cleanCode.replace('CCK-', ''); 
    const timeStr = body.substring(0, 4);
    const randStr = body.substring(4, 7);
    const checksum = body.substring(7, 8);

    // 计算防伪码
    const baseStr = timeStr + randStr;
    let sum = 0;
    for(let i = 0; i < 7; i++) {
        sum += baseStr.charCodeAt(i) * (i + 1);
    }
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const expectedChecksum = chars[sum % 36];

    // 错误类型 3：密码输错了（暗号校验对不上，防止买家瞎蒙）
    if (checksum !== expectedChecksum) {
        return res.status(401).json({ success: false, message: '❌ 无效的测试码（防伪校验失败，请仔细核对是否输错字母或数字）' });
    }

    // 时间解密与验证
    const codeHours = parseInt(timeStr, 36); 
    const currentHours = Math.floor(Date.now() / (1000 * 60 * 60)); 
    const hoursDiff = currentHours - codeHours; 

    // 错误类型 4：密码已过期
    if (hoursDiff > 720) {
        return res.status(401).json({ 
            success: false, 
            message: `⚠️ 该测试码已失效（距生成已超过 30 天，系统已在云端自动将其销毁）。` 
        });
    }
    
    // 错误类型 5：时空异常（基本不可能发生，除非服务器时间乱了）
    if (hoursDiff < 0) {
        return res.status(401).json({ success: false, message: '❌ 测试码时空异常，请联系管理员。' });
    }

    // 全部通过！
    res.status(200).json({ success: true, message: '验证成功' });
}
