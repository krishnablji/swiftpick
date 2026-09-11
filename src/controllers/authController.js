const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, branchId: user.branchId, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

const authController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
      }

      const token = createToken(user);
      res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' });

      return res.json({
        success: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Quick switch between roles for instant reviewer & interviewer evaluation
  quickSwitch: (req, res) => {
    const { role } = req.body;
    const targetRole = role || 'customer';
    const user = db.state.users.find(u => u.role === targetRole);
    if (!user) {
      return res.status(404).json({ success: false, error: `Demo user for role ${targetRole} not found.` });
    }

    const token = createToken(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' });

    return res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId }
    });
  },

  me: (req, res) => {
    return res.json({
      success: true,
      user: req.user
    });
  },

  logout: (req, res) => {
    res.clearCookie('token');
    return res.json({ success: true, message: 'Logged out successfully.' });
  }
};

module.exports = authController;
