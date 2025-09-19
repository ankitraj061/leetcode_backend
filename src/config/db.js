import mongoose from "mongoose";

async function main(){
    mongoose.connect(process.env.DB_CONNECT_STRING)
}

export default main