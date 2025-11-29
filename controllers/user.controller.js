import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Organization } from "../models/organization.model.js";

// --- Helper function to generate tokens ---
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };

  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};


// --- 1. REGISTER USER Controller ---
const registerUser = asyncHandler(async (req, res) => {
  // 1. Get user details from request
  const { username, email, password, business_name, state } = req.body;

  // 2. Validation
  if (!username || !email || !password || !business_name || !state) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. Check if user already exists
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  // 4. Create new user
  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password
  });
  
  // 5. Create an organization for this user
  const organization = await Organization.create({
    owner: user._id,
    business_name,
    address: {
      state
    }
  });

  // 6. Get the created user (without the password)
  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  // 7. Send response
  return res.status(201).json(
    new ApiResponse(201, { user: createdUser, organization }, "User registered successfully")
  );
});

// --- 2. LOGIN USER Controller ---
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User does not exist"
            })
        }

        const isPasswordValid = await user.isPasswordCorrect(password)

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            })
        }

        const accessToken = user.generateAccessToken()

        const loggedInUser = await User.findById(user._id).select("-password")

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .json({
                success: true,
                user: loggedInUser,
                accessToken
            })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in login",
            error: error.message
        })
    }
};

// --- 3. LOGOUT USER Controller ---
const logoutUser = asyncHandler(async (req, res) => {
  // The `verifyJWT` middleware has already run,
  // so we have access to `req.user`
  
  // We just need to clear the `refreshToken` from the database
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined // or ""
      }
    },
    {
      new: true
    }
  );

  // Clear the cookies from the response
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});


// Export all controllers
export { 
  registerUser, 
  loginUser, 
  logoutUser 
};
