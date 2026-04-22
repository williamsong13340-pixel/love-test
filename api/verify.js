// api/verify.js
export default function handler(req, res) {
    // 限制只能通过 POST 方法请求
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '方法不允许' });
    }

    const { code } = req.body;

    // 从 Vercel 的环境变量中获取你设置的密码列表
    // 假设你在 Vercel 后台设置的密码是 "MIMA01,MIMA02,MIMA03"
    const validCodesString = process.env.VALID_CODES || "";
    
    // 把逗号分隔的密码变成一个数组
    const validCodes = validCodesString.split(',').map(c => c.trim().toUpperCase());

    // 检查用户输入的密码是否在列表里
    if (code && validCodes.includes(code.trim().toUpperCase())) {
        res.status(200).json({ success: true, message: '验证成功' });
    } else {
        res.status(401).json({ success: false, message: '无效的测试码' });
    }
}
