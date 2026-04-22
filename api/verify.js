// api/verify.js
export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '不允许' });
    }

    const { code } = req.body;
    if (!code) {
        return res.status(401).json({ success: false, message: '请输入测试码' });
    }

    // 假设我们的密码格式是： CCK-XXXXXX (例如 CCK-123456)
    const cleanCode = code.trim().toUpperCase();
    
    // 1. 检查是不是 CCK- 开头，并且总长度是 10 位
    if (!cleanCode.startsWith('CCK-') || cleanCode.length !== 10) {
        return res.status(401).json({ success: false, message: '无效的测试码' });
    }

    // 2. 把 CCK- 切掉，只留下后面的 6 位数字
    const numbers = cleanCode.replace('CCK-', '');
    
    // 检查留下的是不是纯数字
    if (!/^\d{6}$/.test(numbers)) {
        return res.status(401).json({ success: false, message: '无效的测试码' });
    }

    // 3. 核心加密算法（前5个数字经过计算，必须等于第6个数字）
    const n1 = parseInt(numbers[0]);
    const n2 = parseInt(numbers[1]);
    const n3 = parseInt(numbers[2]);
    const n4 = parseInt(numbers[3]);
    const n5 = parseInt(numbers[4]);
    const checksum = parseInt(numbers[5]); // 最后一位是验证位

    // 绝密公式：把前5个数字分别乘 2, 3, 4, 5, 6，加起来，然后取个位数
    const expectedChecksum = (n1 * 2 + n2 * 3 + n3 * 4 + n4 * 5 + n5 * 6) % 10;

    // 4. 只有计算结果对得上，才是真密码！
    if (checksum === expectedChecksum) {
        res.status(200).json({ success: true, message: '验证成功' });
    } else {
        res.status(401).json({ success: false, message: '无效的测试码' });
    }
}
