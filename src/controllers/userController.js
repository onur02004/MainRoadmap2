import * as userService from '../services/userService.js';
import logger from '../utils/logger.js';

export const updateAvatar = async (req, res) => {

  try {

    const {
      avatar_type,
      avatar_data,
      profile_pic_path
    } = req.body;

    const userId = req.user.id;
    const username = req.user.user_name;


    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    const allowedTypes = [
      'builtin',
      'blobatar',
      'pixel',
      'photo'
    ];

    if (
      !avatar_type ||
      !allowedTypes.includes(avatar_type)
    ) {

      logger.error('USER', `Invalid avatar type: ${avatar_type}`);
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz avatar türü.'
      });

    }


    // ----------------------------------------------------------
    // AVATAR DATA
    // ----------------------------------------------------------

    if (
      avatar_data !== undefined &&
      (
        typeof avatar_data !== 'object' ||
        avatar_data === null ||
        Array.isArray(avatar_data)
      )
    ) {

      logger.error('USER', `Invalid avatar data for user ${userId}: ${JSON.stringify(avatar_data)}`);
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz avatar verisi.'
      });

    }


    // ----------------------------------------------------------
    // PHOTO PATH
    //
    // Şimdilik sadece DB'de saklıyoruz.
    // Gerçek upload sistemini daha sonra yapacağız.
    // ----------------------------------------------------------

    if (
      profile_pic_path !== undefined &&
      profile_pic_path !== null &&
      typeof profile_pic_path !== 'string'
    ) {

      logger.error('USER', `Invalid profile picture path for user ${userId}: ${profile_pic_path}`);
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz profil fotoğrafı yolu.'
      });

    }


    // ----------------------------------------------------------
    // DATABASE
    // ----------------------------------------------------------

    const updatedUser =
      await userService.updateUserAvatar(
        userId,
        avatar_type,
        avatar_data || {},
        profile_pic_path || null
      );


    if (!updatedUser) {

      logger.error('USER', `User not found: ${userId}`);
      return res.status(404).json({
        status: 'error',
        message: 'Kullanıcı bulunamadı.'
      });

    }


    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    logger.info('USER', `Avatar updated for user: ${userId}`, { avatar_type, profile_pic_path });
    res.status(200).json({

      status: 'success',

      message:
        `Avatarın başarıyla kaydedildi, ${username}!`,

      data: {

        user: {

          id:
            updatedUser.id,

          user_name:
            updatedUser.user_name,

          email:
            updatedUser.email,

          relation:
            updatedUser.relation,

          avatar_type:
            updatedUser.avatar_type,

          avatar_data:
            updatedUser.avatar_data,

          profile_pic_path:
            updatedUser.profile_pic_path

        }

      }

    });

  }

  catch (error) {
    
    logger.error('USER', `Error updating avatar for user ${userId}:`, error);

    res.status(500).json({

      status: 'error',

      message:
        'Avatar kaydedilirken bir hata oluştu.'

    });

  }

};

export const createAvatarDesign = async (req, res) => {

  try {

    const {
      design_type,
      name,
      design_data
    } = req.body;

    const userId = req.user.id;

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    const allowedTypes = [
      'pixel',
      'blobatar'
    ];

    if (
      !design_type ||
      !allowedTypes.includes(design_type)
    ) {

      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz tasarım türü.'
      });

    }


    if (
      !name ||
      typeof name !== 'string' ||
      name.trim().length === 0
    ) {

      logger.error('USER', `Design name is required for user ${userId}`);
      return res.status(400).json({
        status: 'error',
        message: 'Tasarım adı gerekli.'
      });

    }


    if (
      !design_data ||
      typeof design_data !== 'object' ||
      Array.isArray(design_data)
    ) {

      logger.error('USER', `Invalid design data for user ${userId}: ${JSON.stringify(design_data)}`);
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz tasarım verisi.'
      });

    }


    // ----------------------------------------------------------
    // DATABASE
    // ----------------------------------------------------------

    const design =
      await userService.createAvatarDesign(
        userId,
        design_type,
        name.trim(),
        design_data
      );


    if (!design) {

      logger.error('USER', `Failed to create design for user ${userId}`);
      return res.status(500).json({
        status: 'error',
        message: 'Tasarım kaydedilemedi.'
      });

    }


    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    logger.info('USER', `Avatar design created for user: ${userId}`, { design_type, name });
    return res.status(201).json({

      status: 'success',

      message: 'Tasarım başarıyla kaydedildi.',

      data: {
        design
      }

    });

  }

  catch (error) {

    logger.error('USER', `Error creating avatar design for user ${userId}:`, error);

    return res.status(500).json({

      status: 'error',

      message:
        'Tasarım kaydedilirken bir hata oluştu.'

    });

  }

};