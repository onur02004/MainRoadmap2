import * as userService from '../services/userService.js';

export const updateAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    const userId = req.user.id;
    const username = req.user.user_name;

    // 1. Validasyon
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Lütfen geçerli bir avatar dosya yolu belirtin.'
      });
    }

    // Güvenlik: Sadece /content/avatars/ altındaki yollara izin ver
    if (!avatar.startsWith('/content/avatars/')) {
      return res.status(400).json({
        status: 'error',
        message: 'Güvenlik uyarısı: Yalnızca onaylı avatar havuzundan seçim yapılabilir.'
      });
    }

    // 2. Servis üzerinden DB Güncelleme
    const updatedUser = await userService.updateUserAvatar(userId, avatar);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Kullanıcı kaydı bulunamadı.'
      });
    }

    // 3. Başarılı Yanıt
    res.status(200).json({
      status: 'success',
      message: `Profil avatarın başarıyla güncellendi, ${username}!`,
      data: {
        user: {
          id: updatedUser.id,
          user_name: updatedUser.user_name,
          email: updatedUser.email,
          profile_pic_path: updatedUser.profile_pic_path,
          relation: updatedUser.relation
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};