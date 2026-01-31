import { AtlasChat } from "@/components/chat/AtlasChat";
import { Helmet } from "react-helmet";

const Index = () => {

  return (
    <>
      <Helmet>
        <title>Atlas - Din Körkortsguide</title>
        <meta name="description" content="Atlas är din personliga körkortsguide. Få svar på frågor om körkort, priser och hitta rätt trafikskola." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Helmet>
      
      <div className="h-screen w-screen overflow-hidden bg-background">
        {/* Full-screen chat container */}
        <div className="h-full w-full max-w-lg mx-auto shadow-chat bg-card">
          <AtlasChat />
        </div>
      </div>
    </>
  );
};

export default Index;
