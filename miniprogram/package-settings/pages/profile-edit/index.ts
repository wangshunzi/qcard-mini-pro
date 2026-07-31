import {
  getDefaultAvatars,
  getProfile,
  updateProfile,
} from "../../../services/profile";
import { UI_ASSETS } from "../../../config/uiAssets";

Page({
  data: {
    loading: true,
    saving: false,
    nickname: "",
    avatar: "",
    selectedAvatarId: "",
    gender: "",
    birthday: "",
    bio: "",
    maxDate: new Date().toISOString().slice(0, 10),
    avatars: [] as Array<{ id: string; name: string; url: string; imagePath: string }>,
    assets: UI_ASSETS,
    avatarDrawerOpen: false,
    initialSignature: "",
    hasChanges: false,
  },

  onLoad() {
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [profile, result] = await Promise.all([getProfile(), getDefaultAvatars()]);
      const avatars = result.items ?? [];
      const currentAvatar = String(profile.avatar || "");
      const selected = avatars.find((item) =>
        item.url === currentAvatar ||
        (item.imagePath && currentAvatar.endsWith(item.imagePath)),
      );
      const values = {
        nickname: profile.nickname || "",
        avatar: selected?.url || currentAvatar,
        selectedAvatarId: profile.defaultAvatarId || selected?.id || "",
        gender: profile.gender || "",
        birthday: profile.birthday ? profile.birthday.slice(0, 10) : "",
        bio: profile.bio || "",
        avatars,
      };
      this.setData({
        ...values,
        initialSignature: this.signature(values),
        hasChanges: false,
      });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "资料加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  onNickname(event: WechatMiniprogram.Input) {
    this.setData({ nickname: event.detail.value.slice(0, 20) }, () => this.syncChanged());
  },

  onBio(event: WechatMiniprogram.Input) {
    this.setData({ bio: event.detail.value.slice(0, 200) }, () => this.syncChanged());
  },

  chooseGender() {
    wx.showActionSheet({
      itemList: ["男", "女", "保密"],
      success: ({ tapIndex }) => this.setData(
        { gender: ["male", "female", "unknown"][tapIndex] },
        () => this.syncChanged(),
      ),
    });
  },

  onBirthday(event: WechatMiniprogram.PickerChange) {
    this.setData({ birthday: String(event.detail.value) }, () => this.syncChanged());
  },

  openAvatarDrawer() {
    this.setData({ avatarDrawerOpen: true });
  },

  closeAvatarDrawer() {
    this.setData({ avatarDrawerOpen: false });
  },

  preventClose() {},

  signature(values: {
    nickname?: string;
    selectedAvatarId?: string;
    gender?: string;
    birthday?: string;
    bio?: string;
  }) {
    return JSON.stringify({
      nickname: values.nickname || "",
      selectedAvatarId: values.selectedAvatarId || "",
      gender: values.gender || "",
      birthday: values.birthday || "",
      bio: values.bio || "",
    });
  },

  syncChanged() {
    this.setData({
      hasChanges: this.signature(this.data) !== this.data.initialSignature,
    });
  },

  chooseAvatar(event: WechatMiniprogram.TouchEvent) {
    this.setData({
      avatar: String(event.currentTarget.dataset.url || ""),
      selectedAvatarId: String(event.currentTarget.dataset.id || ""),
      avatarDrawerOpen: false,
    }, () => this.syncChanged());
  },

  async save() {
    const nickname = this.data.nickname.trim();
    if (!nickname) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    try {
      await updateProfile({
        nickname,
        defaultAvatarId: this.data.selectedAvatarId || undefined,
        gender: this.data.gender || undefined,
        birthday: this.data.birthday || undefined,
        bio: this.data.bio || undefined,
      });
      wx.showToast({ title: "保存成功", icon: "success" });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
