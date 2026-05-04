import Discover from './pages/Discover';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Itinerary from './pages/Itinerary';
import Map from './pages/Map';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Saved from './pages/Saved';
import Search from './pages/Search';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Discover": Discover,
    "Home": Home,
    "Inbox": Inbox,
    "Itinerary": Itinerary,
    "Map": Map,
    "Messages": Messages,
    "Profile": Profile,
    "Saved": Saved,
    "Search": Search,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};