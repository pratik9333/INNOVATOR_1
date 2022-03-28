const User = require("../models/User.model");
const getCookieToken = require("../utils/cookieToken");
const cloudinary = require("cloudinary");
const Query = require("../utils/query");

exports.signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!req.files) {
      return res.status(400).json({ error: "Photo is required to signup" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const findExistingEmail = await User.findOne({ email });

    if (findExistingEmail) {
      return res.status(400).json({
        error:
          "Email is already registered, please try again with another email",
      });
    }

    const file = req.files.photo;

    //uploading file to cloudinary
    const result = await cloudinary.v2.uploader.upload(file.tempFilePath, {
      folder: "users",
      width: 150,
      crop: "scale",
    });

    //creating user
    const user = await User.create({
      name,
      email,
      password,
      photo: {
        id: result.public_id,
        url: result.secure_url,
      },
    });

    //this will create token, store in cookie and will send response to frontend
    getCookieToken(user, res);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "please provide email and password" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "email is incorrect" });
    }

    const validatePassword = await user.validatePassword(password);

    //validating email and password
    if (!validatePassword) {
      return res.status(401).json({ error: "password is incorrect" });
    }

    getCookieToken(user, res, req);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.logout = async (req, res) => {
  const options = {
    expires: new Date(Date.now()),
    httpOnly: true,
  };

  res.status(200).cookie("token", null, options).json({
    success: true,
    message: "Logout Success",
  });
};

exports.getLoggedInUserDetails = (req, res) => {
  const user = req.user;
  //sending user details back if logged in
  res.status(200).json({ success: true, user });
};

exports.updateUserDetails = async (req, res) => {
  try {
    let updateUser = {
      name: req.body.name ? req.body.name : req.user.name,
      email: req.body.email ? req.body.email : req.user.email,
    };

    if (req.files) {
      const imageId = req.user.photo.id;

      //delete photo on cloudinary
      await cloudinary.v2.uploader.destroy(imageId);

      //uploading file to cloudinary
      const result = await cloudinary.v2.uploader.upload(
        req.files.photo.tempFilePath,
        {
          folder: "users",
          width: 150,
          crop: "scale",
        }
      );
      updateUser = {
        ...updateUser,
        photo: {
          id: result.public_id,
          url: result.secure_url,
        },
      };
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateUser, {
      new: true,
    });

    updatedUser.password = undefined;
    updatedUser.createdAt = undefined;
    updatedUser.__v = undefined;

    res
      .status(200)
      .json({ success: true, message: "User profile is updated", updatedUser });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.addGithubId = async (req, res) => {
  try {
    if (!req.body.githubId) {
      return res.status(401).json({ error: "Please provide github id" });
    }
    const user = User.findById(req.user._id);

    user.githubId = req.body.githubId;

    await user.save();
    res.status(200).json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    const resultPerPage = 6;

    //creating object from our custom class and passing base = User.find(), bigQ = req.query
    const userObj = new Query(User.find(), req.query);

    userObj.search();

    userObj.pager(resultPerPage);

    let Users = await userObj.base;

    let filteredUsers = Users.length;

    res.status(200).json({
      success: true,
      Users,
      totalUsersCount: usersCount,
      filteredUsers: filteredUsers,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    if (!req.params.userId) {
      return res.status(400).json({ error: "Please provide friend's user id" });
    }

    const user = await User.findById(req.params.userId);

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    //first test case
    for (let friend of req.user.friendRequests) {
      if (friend.toString() === req.params.userId) {
        return res
          .status(400)
          .json({ error: "User had already sent you friend request" });
      }
    }

    //second test case
    for (let friend of user.friendRequests) {
      if (friend.toString() === req.user._id.toString()) {
        return res
          .status(400)
          .json({ error: "Friend request was already sent" });
      }
    }

    // third test case
    for (let friend of user.friends) {
      if (friend.toString() === req.user._id.toString()) {
        return res.status(400).json({ error: "User is already friend" });
      }
    }

    user.friendRequests.push(req.user._id);

    await user.save();

    res.status(200).json({ success: true, message: "Friend request is sent" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.addFriend = async (req, res) => {
  try {
    if (!req.params.userId) {
      return res.status(400).json({ error: "Please provide friend user id" });
    }

    const currrentUser = await User.findById(req.user._id);
    const usersFriend = await User.findById(req.params.userId);

    let lengthFriendRequests = currrentUser.friendRequests.length;

    let filteredFriendRequest = currrentUser.friendRequests.filter(
      (friend) => friend._id.toString() !== usersFriend._id.toString()
    );

    //test case 1
    for (let friend of usersFriend.friends) {
      if (friend._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ error: "User is already friend" });
      }
    }

    //test case 2
    if (lengthFriendRequests === filteredFriendRequest.length) {
      return res.status(400).json({ error: "Invalid Id" });
    }

    currrentUser.friendRequests = filteredFriendRequest.slice(0);

    currrentUser.friends.push(usersFriend._id);
    usersFriend.friends.push(currrentUser._id);

    await currrentUser.save();
    await usersFriend.save();

    res.status(200).json({ success: true, message: "Friend added" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.rateUser = async (req, res) => {
  try {
    const { up, down } = req.body;

    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Please provide user id" });
    }

    if (!up && !down) {
      return res
        .status(400)
        .json({ error: "Please provide upvote or downvote" });
    }

    const user = await User.findById(userId);

    if (up) {
      user.upvotes += 1;
    } else {
      user.downvotes += 1;
    }

    user.votes += 1;

    user.rating = (user.upvotes / (user.upvotes + user.downvotes || 1)) * 100;

    await user.save();

    res
      .status(200)
      .json({ success: true, message: `${user.name} was rated successfully` });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Server has occured some problem, please try again" });
  }
};

exports.getLeaderBoardData = async (req, res, next) => {
  try {
    const usersCount = await User.countDocuments();
    const resultPerPage = 10;

    const userObj = new Query(User.find(), req.query);

    userObj.sort();

    userObj.pager(resultPerPage);

    let Users = await userObj.base;
    let filteredUsers = Users.length;

    return res.status(200).json({
      success: true,
      data: Users,
      filteredUsers,
      usersCount,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      success: false,
      data: error.message,
    });
  }
};
