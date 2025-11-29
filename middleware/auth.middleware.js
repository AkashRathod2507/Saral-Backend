import { User } from "../models/user.model.js";
import { Organization } from "../models/organization.model.js"; // <-- Make sure this is imported
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }
    
    // --- THIS IS THE CRUCIAL PART ---
    // Find the organization owned by this user
    const organization = await Organization.findOne({ owner: user._id });
    
    if (!organization) {
      // This might happen if org creation failed or was deleted
      throw new ApiError(401, "User organization not found");
    }
    
    // Attach both user and organization info to the request
    req.user = user;
    req.organization_id = organization._id; // <-- THIS LINE IS THE FIX
    // --- END CRUCIAL PART ---
    
    next();

  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});