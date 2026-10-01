import * as userService from '../services/userService.js';

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

      return res.status(404).json({
        status: 'error',
        message: 'Kullanıcı bulunamadı.'
      });

    }


    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

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

    console.error(
      'Avatar update error:',
      error
    );

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

      return res.status(500).json({
        status: 'error',
        message: 'Tasarım kaydedilemedi.'
      });

    }


    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    return res.status(201).json({

      status: 'success',

      message: 'Tasarım başarıyla kaydedildi.',

      data: {
        design
      }

    });

  }

  catch (error) {

    console.error(
      'Avatar design creation error:',
      error
    );

    return res.status(500).json({

      status: 'error',

      message:
        'Tasarım kaydedilirken bir hata oluştu.'

    });

  }

};