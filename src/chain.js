import { ethers } from "ethers";
import { loadAbi } from "./artifacts.js";

export function makeChain(config) {
  const provider = new ethers.JsonRpcProvider(config.RPC_URL, Number(config.CHAIN_ID));
  const admin = new ethers.Wallet(config.ADMIN_PRIVATE_KEY, provider);

  const artifactsDir = config.NI99A_ARTIFACTS_DIR;

  // Имена контрактов берём по техспеке (и файлам в ni99achain)
  // Если в артефактах они называются иначе — поменяешь здесь 3 строки.
  const GovTokenAbi = loadAbi(artifactsDir, "GovToken");
  const MeritOracleAbi = loadAbi(artifactsDir, "MeritOracle");
  const MeritGovernorAbi = loadAbi(artifactsDir, "MeritGovernor");

  const govToken = new ethers.Contract(config.GOVTOKEN_ADDRESS, GovTokenAbi, provider);
  const oracle = new ethers.Contract(config.ORACLE_ADDRESS, MeritOracleAbi, provider);
  const governor = new ethers.Contract(config.GOVERNOR_ADDRESS, MeritGovernorAbi, provider);

  // allowlist (если отдельный контракт) — минимальный ABI-плейсхолдер
  const allowlist = config.ALLOWLIST_ADDRESS
    ? new ethers.Contract(
        config.ALLOWLIST_ADDRESS,
        [
          "function setAllowed(address who, bool allowed) external",
          "function isAllowed(address who) view returns (bool)",
        ],
        admin
      )
    : null;

  function userSignerFromPrivateKey(pk) {
    return new ethers.Wallet(pk, provider);
  }

  async function fundUser(address, ethAmount = "0.05") {
    const tx = await admin.sendTransaction({
      to: address,
      value: ethers.parseEther(ethAmount),
    });
    await tx.wait();
    return tx.hash;
  }

  async function allowUser(address) {
    if (!allowlist) return null;
    const tx = await allowlist.setAllowed(address, true);
    await tx.wait();
    return tx.hash;
  }

  async function delegateSelf(userWallet) {
    // GovToken.delegate(self)
    const tokenAsUser = govToken.connect(userWallet);
    const tx = await tokenAsUser.delegate(await userWallet.getAddress());
    await tx.wait();
    return tx.hash;
  }

  async function previewVotePower(proposalId, voterAddress) {
    const pid = BigInt(proposalId);

    const topicId = await governor.proposalTopic(pid);
    const snap = await governor.proposalSnapshot(pid);

    // Важно: как в твоём сообщении — snapshot-1
    const timepoint = BigInt(snap) - 1n;

    const baseVotes = await govToken.getPastVotes(voterAddress, timepoint);

    const nowTs = BigInt(Math.floor(Date.now() / 1000));
    const cap = await oracle.weightAtTopic(voterAddress, nowTs, topicId);

    const effective = baseVotes < cap ? baseVotes : cap;

    return {
      topicId: Number(topicId),
      snapshotBlock: Number(snap),
      baseVotes: baseVotes.toString(),
      cap: cap.toString(),
      effective: effective.toString(),
    };
  }

  async function proposalDetails(proposalId) {
    const pid = BigInt(proposalId);
    const topicId = await governor.proposalTopic(pid);
    const state = await governor.state(pid);
    const snapshot = await governor.proposalSnapshot(pid);
    const deadline = await governor.proposalDeadline(pid);
    const votes = await governor.proposalVotes(pid); // { againstVotes, forVotes, abstainVotes } or tuple

    return {
      proposalId: String(proposalId),
      topicId: Number(topicId),
      state: Number(state),
      snapshotBlock: Number(snapshot),
      deadlineBlock: Number(deadline),
      votes: {
        against: votes[0].toString(),
        for: votes[1].toString(),
        abstain: votes[2].toString(),
      },
    };
  }

  async function voteReceipt(proposalId, voter) {
    const pid = BigInt(proposalId);
    const r = await governor.voteReceipt(pid, voter); // ожидаем tuple (against, for, abstain)
    return {
      against: r[0].toString(),
      for: r[1].toString(),
      abstain: r[2].toString(),
    };
  }

  async function castVoteSimple(userWallet, proposalId, support) {
    const govAsUser = governor.connect(userWallet);
    const tx = await govAsUser.castVote(BigInt(proposalId), Number(support));
    const rc = await tx.wait();
    return { txHash: tx.hash, blockNumber: rc.blockNumber };
  }

  async function castVoteFractional(userWallet, proposalId, split, reason = "") {
    const govAsUser = governor.connect(userWallet);

    // params = 48 bytes: uint128 against | uint128 for | uint128 abstain
    const params = ethers.solidityPacked(
      ["uint128", "uint128", "uint128"],
      [BigInt(split.against), BigInt(split.for), BigInt(split.abstain)]
    );

    const tx = await govAsUser.castVoteWithReasonAndParams(
      BigInt(proposalId),
      255,
      reason,
      params
    );
    const rc = await tx.wait();
    return { txHash: tx.hash, blockNumber: rc.blockNumber };
  }

  return {
    provider,
    admin,
    govToken,
    oracle,
    governor,
    userSignerFromPrivateKey,
    fundUser,
    allowUser,
    delegateSelf,
    previewVotePower,
    proposalDetails,
    voteReceipt,
    castVoteSimple,
    castVoteFractional,
  };
}
