// api/verify.js
export default function handler(req, res) {
    // 限制请求方式
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '请求方法不允许' });
    }

    const { code } = req.body;
    
    // 【排查点 1：空值】买家什么都没填就点验证
    if (!code) {
        return res.status(401).json({ success: false, message: '请输入测试码' });
    }

    // 格式化：转大写，去空格
    const cleanCode = code.trim().toUpperCase();
    
    // 【排查点 2：格式错误】没带CCK前缀，或者少复制/多复制了字母
    if (!cleanCode.startsWith('CCK-') || cleanCode.length !== 12) {
        return res.status(401).json({ 
            success: false, 
            message: '【格式错误】请输入完整的12位测试码（需包含 CCK- 前缀）' 
        });
    }

    // 截取核心部分
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

    // 【排查点 3：伪造或输错】长度对，但是公式算出来对不上。说明买家看错字母了，或者在瞎编密码
    if (checksum !== expectedChecksum) {
        return res.status(401).json({ 
            success: false, 
            message: '【无效代码】未找到该授权码，请检查是否有字母 O 和数字 0 看混淆的情况' 
        });
    }

    // 解析时间戳
    const codeHours = parseInt(timeStr, 36); 
    const currentHours = Math.floor(Date.now() / (1000 * 60 * 60)); 
    const hoursDiff = currentHours - codeHours; 

    // 【排查点 4：已过期】超过了 720 小时（30天）
    if (hoursDiff > 720) {
        return res.status(401).json({ 
            success: false, 
            message: '【已过期】该测试码生成已超过30天，根据隐私保护机制，已在云端自动销毁。' 
        });
    }
    
    // 【排查点 5：时间异常】预防买家穿越，或者服务器时间出错
    if (hoursDiff < 0) {
        return res.status(401).json({ 
            success: false, 
            message: '【系统提示】测试码时间异常，请联系客服补发。' 
        });
    }

    // 全部验证通过！发放通行证
    res.status(200).json({ success: true, message: '验证成功，正在开启测试...' });
}
