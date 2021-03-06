import React, { Fragment, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useFirebase, useFirestoreConnect } from "react-redux-firebase";
import "bootstrap";
import qs from "qs";

import { startTimer, stopTimer, setUser, leaveRoom } from "./actions";

import Announcements from "./Announcements";
import Chatbox from "./Chatbox";
import EntranceExperience from "components/organisms/EntranceExperience";
import Header from "./Header";
import LockedSite from "./LockedSite";
import Map from "./Map";
import Rooms from "./Rooms";

import { LINEUP } from "./lineup";
import { LOCK_SITE_AFTER_UTC_SECONDS, PARTY_START_UTC_SECONDS } from "./config";

export default function App(props) {
  const firebase = useFirebase();
  const dispatch = useDispatch();
  useFirestoreConnect("users");
  const { user, users, time, timerInterval } = useSelector((state) => ({
    user: state.user,
    users: state.firestore.ordered.users,
    time: state.timer.time,
    timerInterval: state.timer.timerInterval,
  }));

  function killLoginsFromBeforePartyStart(user) {
    if (user) {
      const partyHasStarted = time >= PARTY_START_UTC_SECONDS;
      const lastSignInTimeSeconds =
        new Date(user.metadata.lastSignInTime) / 1000;
      const signedInBeforePartyStart =
        lastSignInTimeSeconds < PARTY_START_UTC_SECONDS;

      if (partyHasStarted && signedInBeforePartyStart) {
        firebase.auth().signOut();
      }
    }
  }

  // REVISIT: properly wrap dependencies in useRef per https://github.com/facebook/create-react-app/issues/6880
  useEffect(() => {
    dispatch(startTimer());
    return () => {
      dispatch(stopTimer(timerInterval));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // REVISIT: properly wrap dependencies in useRef per https://github.com/facebook/create-react-app/issues/6880
  useEffect(() => {
    firebase.auth().onAuthStateChanged((user) => {
      dispatch(setUser(user));
      killLoginsFromBeforePartyStart(user);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Remove room presence etc. on disconnect
    window.onbeforeunload = () => {
      if (user) {
        dispatch(leaveRoom(user.uid));
      }
    };
  }, [dispatch, user]);

  const attendances = users
    ? users.reduce((acc, value) => {
        acc[value.room] = (acc[value.room] || 0) + 1;
        return acc;
      }, {})
    : [];

  const search = qs.parse(props.location.search, { ignoreQueryPrefix: true });
  const unlock = search.unlock !== undefined;

  if (!unlock && time >= LOCK_SITE_AFTER_UTC_SECONDS) {
    return <LockedSite />;
  }

  if (!user) {
    return <EntranceExperience />;
  }

  return (
    <Fragment>
      <Header />
      <div className="container">
        <div className="row">
          <div className="col">
            <Map rooms={LINEUP.rooms} attendances={attendances} />
            <Rooms rooms={LINEUP.rooms} attendances={attendances} />
            <Announcements />
            <Chatbox />
          </div>
        </div>
      </div>
    </Fragment>
  );
}
