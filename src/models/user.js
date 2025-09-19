import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
    firstName:{
        type: String,
        required: true,
        minLength: 3,
        maxLength: 20
    },
    lastName:{
        type: String,
    },
    emailId:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        immutable: true
    },
    age:{
        type: Number,
        min :6,
        max:80
    },
    gender:{
        type: String,
        validate(value){
            if(!['male','female',['others']].includes(value)){
                throw new Error('Invalid gender')
            }
        }
    },
    role:{
        type: String,
        enum:['admin','user'],
        default:'user'
    },
    problemsSolved: [{
    type: Schema.Types.ObjectId,
    ref: 'Problem',
    default:[]
}],

    password:{
        type: String,
        required: true
    }

},{
    timestamps: true
}
);
const User = mongoose.model('User', userSchema);

export default User;
