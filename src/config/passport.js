import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.js';
import { generateUsername } from '../utils/validator.js';
import dotenv from 'dotenv';
dotenv.config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists with this Google ID
        let existingUser = await User.findOne({ googleId: profile.id });
        
        if (existingUser) {
            // Update login tracking
            existingUser.lastLoginAt = new Date();
            existingUser.loginCount += 1;
            await existingUser.save();
            return done(null, existingUser);
        }

        // Check if user exists with same email (link accounts)
        let existingEmailUser = await User.findOne({ emailId: profile.emails[0].value });
        
        if (existingEmailUser) {
            // Link Google account to existing user
            existingEmailUser.googleId = profile.id;
            existingEmailUser.authProvider = 'google';
            existingEmailUser.profilePicture = profile.photos[0]?.value;
            existingEmailUser.isEmailVerified = true;
            existingEmailUser.lastLoginAt = new Date();
            existingEmailUser.loginCount += 1;
            await existingEmailUser.save();
            return done(null, existingEmailUser);
        }

        // Create new user with Google account
        const username = await generateUsername(profile.name.givenName);
        
        const newUser = await User.create({
            googleId: profile.id,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName || '',
            emailId: profile.emails[0].value,
            username: username,
            profilePicture: profile.photos[0]?.value,
            authProvider: 'google',
            isEmailVerified: true,
            role: 'user',
            lastLoginAt: new Date(),
            loginCount: 1
            // Note: password not required for Google users
        });

        return done(null, newUser);
        
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
