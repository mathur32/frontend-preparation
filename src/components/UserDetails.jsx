import { Button } from "./Button"

export const UserDetails=({name,isOnline}) => {


    return(
        <>
         <h1>{name}</h1>
            <span>{isOnline ? "Online" : "Offline"}</span>
            <p>{isOnline ? "Available for Chat" : "Not available for Chat"}</p>
            {isOnline ? <Button>Send Message</Button> : <small>Last seen 2 hours ago</small>}
        </>
    )
//     if(isOnline){
//     return(
//         <div>
//             <h1>{name}</h1>
//             <span>Online</span>
//             <p>Available for Chat</p>
//             <Button>Send Message</Button>
//         </div>
//     )
// }
//   return(
//      <div>
//             <h1>{name}</h1>
//             <span>Offline</span>
//             <p>Not available for Chat</p>
//             <small>Last seen 2 hours ago</small>
//         </div>
//   )
}